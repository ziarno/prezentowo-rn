import { NetworkError } from './errors'
import { Data, type Ddp, meteor } from './meteor'
import { onSession, writableDdp } from './session'

export const DEFAULT_CALL_TIMEOUT_MS = 15_000

export type CallOptions = { timeoutMs?: number }

type Answer = { error: unknown; result: unknown }

type PendingCall = {
  method: string
  params: unknown[]
  // The DDP id once handed to an open socket. Its result can then only come
  // back on that connection.
  sentAs: string | null
  // The server's answer once its `result` is in. Like Meteor's own client, the
  // call settles only when `updated` lists it too: until then the method's
  // writes may not have reached the collections, and a screen that reads them
  // after awaiting the call would show the old values.
  answer: Answer | null
  updated: boolean
  settle: (error: unknown, result?: unknown) => void
}

// Every unsettled call, in call order. Unsent ones wait here for the next
// logged-in connection instead of in the library's queue, which it empties
// whenever a socket closes — defect (A).
const pending: PendingCall[] = []

// Ids of ours still in `Data.calls`. The library never prunes that list, so
// ours are dropped on disconnect, when no result can arrive for them.
const inLibrary = new Set<string>()

// Rejects with a `NetworkError` on timeout (default 15 s, counted from the
// call, including time spent waiting to be sent) or when the connection drops
// after it was sent, unless the result is in by then: the method ran, so it
// settles with that rather than have it sent again. Rejects with the server's
// `MeteorError` otherwise.
export function call<T = void>(
  method: string,
  args?: unknown,
  { timeoutMs = DEFAULT_CALL_TIMEOUT_MS }: CallOptions = {},
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false
    const entry: PendingCall = {
      method,
      params: args === undefined ? [] : [args],
      sentAs: null,
      answer: null,
      updated: false,
      settle: (error, result) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        pending.splice(pending.indexOf(entry), 1)
        if (error) reject(error)
        else resolve(result as T)
      },
    }
    const timer = setTimeout(
      () => settleAnswered(entry, new NetworkError('timeout', method)),
      timeoutMs,
    )
    pending.push(entry)

    const ddp = writableDdp()
    if (ddp) send(entry, ddp)
  })
}

function send(entry: PendingCall, ddp: Ddp) {
  const id = ddp.method(entry.method, entry.params)
  entry.sentAs = id
  inLibrary.add(id)
  // A late result for a call that already timed out lands on a settled entry
  // and is ignored. The entry stays in `Data.calls` until then: the library's
  // `result` handler throws on an id it can't find.
  Data.calls.push({
    id,
    callback: (error, result) => {
      inLibrary.delete(id)
      entry.answer = { error, result }
      if (entry.updated) settleVisible(entry, entry.answer)
    },
  })
}

// With the server's answer, now that its writes are in the collections — and
// in what every tracker read from them: the library re-runs trackers on a
// timer, which a screen rendering on the answer would otherwise beat.
function settleVisible(entry: PendingCall, { error, result }: Answer) {
  if (!meteor.Tracker.inFlush()) meteor.Tracker.flush()
  entry.settle(error, result)
}

// With the server's answer if there is one, or `otherwise`.
function settleAnswered(entry: PendingCall, otherwise: NetworkError) {
  if (entry.answer) entry.settle(entry.answer.error, entry.answer.result)
  else entry.settle(otherwise)
}

onSession({
  ready: () => {
    for (const entry of [...pending]) {
      if (entry.sentAs) continue
      const ddp = writableDdp()
      if (!ddp) return
      send(entry, ddp)
    }
  },
  offline: () => {
    for (const entry of [...pending]) {
      if (entry.sentAs)
        settleAnswered(entry, new NetworkError('disconnected', entry.method))
    }
    if (inLibrary.size === 0) return
    const kept = Data.calls.filter(c => !inLibrary.has(c.id))
    Data.calls.splice(0, Data.calls.length, ...kept)
    inLibrary.clear()
  },
  // Sent, possibly before `result`, once the server has sent every write of
  // the listed calls.
  message: msg => {
    if (msg.msg !== 'updated' || !msg.methods) return
    for (const entry of [...pending]) {
      if (!entry.sentAs || !msg.methods.includes(entry.sentAs)) continue
      entry.updated = true
      if (entry.answer) settleVisible(entry, entry.answer)
    }
  },
})
