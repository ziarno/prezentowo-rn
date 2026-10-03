import { onSessionEnd } from './accounts'
import { call } from './calls'
import { isNetworkError } from './errors'
import { meteor } from './meteor'
import { onSession, writableDdp } from './session'

// The offline write queue (docs/spec.md §6.3, ADR 0004). Only methods
// registered with `queueable` may be submitted. A write made while the
// session can't send — or while earlier ones still wait — is persisted and
// replayed in order once the resume login completes. A replay the server
// rejects is kept as `failed` until discarded; it's never retried.

// - `pending`: not yet accepted by the server.
// - `failed`: the server (or `prepare`) rejected its replay.
export type QueuedWriteState = 'pending' | 'failed'

export type QueuedWrite = {
  id: string
  method: string
  args: unknown
  state: QueuedWriteState
  // Why its replay was rejected: the server's `error` and `reason`.
  failure?: { error: string; reason?: string }
  queuedAt: Date
  // The caller's own notes on the write, kept with it but never sent — e.g.
  // what the present looked like, to show a failed claim on one since removed.
  meta?: unknown
}

export type SubmitOptions = { meta?: unknown }

// One stored write. `data` is EJSON of the `QueuedWrite`; `seq` orders them.
export type QueueRow = { id: string; seq: number; data: string }

// Where the queue persists: the encrypted SQLite database in the app, memory
// in tests.
export type QueueStore = {
  load(): Promise<QueueRow[]>
  put(row: QueueRow): Promise<void>
  remove(id: string): Promise<void>
  clear(): Promise<void>
}

export type Queueable = {
  // Turns queued args into what the method is called with, just before each
  // send — e.g. uploading a photo still on the device. Its result replaces
  // the queued args, so it runs at most once per write that gets that far.
  // Rejecting with a `NetworkError` keeps the write pending.
  prepare?: (args: never) => Promise<unknown>
  // Told when the server has accepted it — sent at once or replayed — with
  // the args it was called with and the method's result.
  sent?: (args: never, result: never) => void
}

const handlers = new Map<string, Queueable>()
// In replay order.
const writes: (QueuedWrite & { seq: number })[] = []
const writesDep = new meteor.Tracker.Dependency()

let store: QueueStore | null = null
let storeWrites: Promise<unknown> = Promise.resolve()
let draining = false
let drainAgain = false
let lastSeq = 0

export function queueable(method: string, handler: Queueable = {}) {
  handlers.set(method, handler)
}

// Reactive. Every write not yet accepted by the server, in replay order.
export function queuedWrites(): QueuedWrite[] {
  writesDep.depend()
  return writes.map(({ seq: _, ...write }) => write)
}

/**
 * Sends `method` now when the session can and nothing is queued ahead of it,
 * resolving `'sent'` once the server accepts it and rejecting with its error
 * otherwise. When it can't, or the connection fails on the way, the write is
 * queued instead and this resolves `'queued'`.
 */
export async function submit(
  method: string,
  args: unknown,
  { meta }: SubmitOptions = {},
): Promise<'sent' | 'queued'> {
  const handler = handlers.get(method)
  if (!handler) throw new Error(`${method} can't be queued`)
  if (!canSend() || writes.some(w => w.state === 'pending')) {
    enqueue(method, args, meta)
    return 'queued'
  }
  let prepared = args
  try {
    prepared = await prepareArgs(handler, args)
    const result = await call(method, prepared)
    handler.sent?.(prepared as never, result as never)
    return 'sent'
  } catch (error) {
    if (!isNetworkError(error)) throw error
    enqueue(method, prepared, meta)
    return 'queued'
  }
}

// Drops a write, typically a failed one the user has seen.
export function discardWrite(id: string) {
  const index = writes.findIndex(w => w.id === id)
  if (index === -1) return
  writes.splice(index, 1)
  writesDep.changed()
  write(s => s.remove(id))
}

// Reads the stored queue — before the session opens, so nothing replays
// ahead of it. `keep: false` empties it instead: nobody is signed in.
export async function loadQueue(queue: QueueStore, { keep = true } = {}) {
  store = queue
  try {
    if (!keep) {
      await queue.clear()
      return
    }
    const rows = await queue.load()
    rows.sort((a, b) => a.seq - b.seq)
    for (const row of rows) {
      const stored = meteor.EJSON.parse(row.data) as QueuedWrite
      writes.push({ ...stored, seq: row.seq })
      lastSeq = Math.max(lastSeq, row.seq)
    }
    writesDep.changed()
  } catch (error) {
    console.warn('Offline queue unreadable, starting empty', error)
    await queue.clear().catch(() => {})
  }
}

function enqueue(method: string, args: unknown, meta: unknown) {
  const entry = {
    id: newId(),
    method,
    args,
    state: 'pending' as const,
    queuedAt: new Date(),
    ...(meta === undefined ? {} : { meta }),
    seq: ++lastSeq,
  }
  writes.push(entry)
  writesDep.changed()
  persist(entry)
  void drain()
}

// Sends the pending writes one at a time, in order, until one can't reach
// the server. Runs again on every logged-in connection.
async function drain() {
  if (draining) {
    drainAgain = true
    return
  }
  draining = true
  try {
    for (;;) {
      drainAgain = false
      const next = writes.find(w => w.state === 'pending')
      if (!next || !canSend()) return
      if (!(await replay(next))) return
    }
  } finally {
    draining = false
    if (drainAgain) void drain()
  }
}

// Whether to go on with the next write.
async function replay(entry: QueuedWrite & { seq: number }) {
  const handler = handlers.get(entry.method) ?? {}
  try {
    if (handler.prepare) {
      entry.args = await prepareArgs(handler, entry.args)
      if (writes.includes(entry)) persist(entry)
    }
    const result = await call(entry.method, entry.args)
    handler.sent?.(entry.args as never, result as never)
    discardWrite(entry.id)
    return true
  } catch (error) {
    if (isNetworkError(error)) return false
    // Discarded, or wiped by a sign-out, while it was on its way.
    if (!writes.includes(entry)) return true
    entry.state = 'failed'
    entry.failure = failureOf(error)
    writesDep.changed()
    persist(entry)
    return true
  }
}

const prepareArgs = (handler: Queueable, args: unknown) =>
  handler.prepare ? handler.prepare(args as never) : Promise.resolve(args)

// Logged in on an open socket: the resume login has completed.
function canSend() {
  return writableDdp() !== null && !!meteor._reactiveDict.get('_userIdSaved')
}

function failureOf(error: unknown): QueuedWrite['failure'] {
  const {
    error: code,
    reason,
    code: otherCode,
  } = (error ?? {}) as {
    error?: unknown
    reason?: unknown
    code?: unknown
  }
  return {
    error: String(code ?? otherCode ?? 'failed'),
    ...(typeof reason === 'string' ? { reason } : {}),
  }
}

function persist({ seq, ...entry }: QueuedWrite & { seq: number }) {
  const row = { id: entry.id, seq, data: meteor.EJSON.stringify(entry) }
  write(s => s.put(row))
}

// Writes run one at a time, in order.
function write(run: (s: QueueStore) => Promise<void>) {
  const target = store
  if (!target) return
  storeWrites = storeWrites
    .then(() => run(target))
    .catch(error => console.warn('Offline queue write failed', error))
}

function newId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
}

onSession({ ready: () => void drain() })

// Queued writes are the signed-in user's: they go with the session.
onSessionEnd(() => {
  writes.splice(0)
  writesDep.changed()
  write(s => s.clear())
})
