import { NetworkError } from './errors'
import { Data, type Ddp } from './meteor'
import { onSession, writableDdp } from './session'

export const DEFAULT_CALL_TIMEOUT_MS = 15_000

export type CallOptions = { timeoutMs?: number }

type PendingCall = {
  method: string
  params: unknown[]
  // The DDP id once handed to an open socket. Its result can then only come
  // back on that connection.
  sentAs: string | null
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
// after it was sent. Rejects with the server's `MeteorError` otherwise.
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
      () => entry.settle(new NetworkError('timeout', method)),
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
      entry.settle(error, result)
    },
  })
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
        entry.settle(new NetworkError('disconnected', entry.method))
    }
    if (inLibrary.size === 0) return
    const kept = Data.calls.filter(c => !inLibrary.has(c.id))
    Data.calls.splice(0, Data.calls.length, ...kept)
    inLibrary.clear()
  },
})
