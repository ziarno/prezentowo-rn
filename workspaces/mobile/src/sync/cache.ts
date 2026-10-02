import {
  onLogin,
  onSessionEnd,
  restoreSession,
  sessionUserId,
} from './accounts'
import { Data, type Doc, TOKEN_KEY, meteor } from './meteor'
import {
  type ConnectOptions as SessionOptions,
  disconnect as closeSession,
  onSession,
  connect as openSession,
} from './session'

// The offline mirror (docs/spec.md §6.2, ADR 0004). Each mirrored
// subscription's data is kept as one snapshot, replaced whole whenever the
// subscription is ready again on a new connection — never merged, no TTL.
// The library wipes its collections on every connection; the union of the
// snapshots is put straight back, and a cached doc is dropped once the
// subscription it came from has been re-sent without it.

// One stored snapshot. `data` is EJSON of `{ [collection]: Doc[] }`.
export type CacheRow = { key: string; eventId: string | null; data: string }

// Where snapshots persist: the encrypted SQLite database in the app, memory
// in tests.
export type CacheStore = {
  load(): Promise<CacheRow[]>
  put(row: CacheRow): Promise<void>
  remove(keys: string[]): Promise<void>
  clear(): Promise<void>
}

export type ConnectOptions = SessionOptions & { cache?: CacheStore }

type Selector = Record<string, unknown>

export type Mirror = {
  // The client-side docs the publication sends, as a selector per
  // collection. It may cover more than the publication sends; never less.
  scope: (params: unknown[]) => Record<string, Selector>
  // The event the subscription belongs to: it's wiped once a fresh
  // `listsEvents` subscription no longer lists that event.
  eventId?: (params: unknown[]) => string
  // The subscription is the full list of the user's events.
  listsEvents?: boolean
}

type Docs = Record<string, Doc[]>
type Snapshot = { eventId: string | null; docs: Docs }
type Live = { eventId: string | null; select: () => Docs }

const SESSION_KEY = 'session'
const FLUSH_DELAY_MS = 100

const mirrors = new Map<string, Mirror>()
const snapshots = new Map<string, Snapshot>()
const snapshotsDep = new meteor.Tracker.Dependency()
// Snapshots ready on this connection, followed through every change until
// the subscription stops or the connection drops.
const live = new Map<string, Live>()
// Keys replaced on this connection.
const replaced = new Set<string>()
// The user's events, once a `listsEvents` subscription is ready on this
// connection.
let listedEvents: Set<string> | null = null
// Docs put back from the snapshots that the server hasn't re-sent on this
// connection, per collection.
const stale = new Map<string, Set<string>>()

let store: CacheStore | null = null
let writes: Promise<unknown> = Promise.resolve()
let flushTimer: ReturnType<typeof setTimeout> | null = null
let loaded = false
let cancelled = false
const loadedDep = new meteor.Tracker.Dependency()

export const keyOf = (name: string, params: unknown[]) =>
  JSON.stringify([name, params])

// Registers how to mirror a publication. Unregistered ones aren't cached.
export function mirror(name: string, config: Mirror) {
  mirrors.set(name, config)
}

// Loads the cache, if one is given, before opening the connection, so cached
// docs can never land on top of fresh ones.
export function connect(endpoint: string, options: ConnectOptions) {
  const { cache, ...sessionOptions } = options
  cancelled = false
  if (!cache) {
    setLoaded()
    openSession(endpoint, sessionOptions)
    return
  }
  store = cache
  load(cache, sessionOptions.storage).finally(() => {
    setLoaded()
    if (!cancelled) openSession(endpoint, sessionOptions)
  })
}

export function disconnect() {
  cancelled = true
  closeSession()
}

// Reactive. True once the cache has been read (or there is none) — the
// splash screen holds until then.
export function cacheReady(): boolean {
  loadedDep.depend()
  return loaded
}

// Reactive. Whether the cache holds data for this subscription, so it can be
// shown before (or without) the server.
export function hasSnapshot(key: string): boolean {
  snapshotsDep.depend()
  return snapshots.has(key)
}

export function subscriptionReady(name: string, params: unknown[]) {
  const config = mirrors.get(name)
  if (!store || !config || !sessionUserId()) return
  const eventId = config.eventId?.(params) ?? null
  // Left over from an event the user is no longer in.
  if (eventId && listedEvents && !listedEvents.has(eventId)) return
  const scope = config.scope(params)
  const key = keyOf(name, params)
  live.set(key, { eventId, select: () => selectFresh(scope) })
  replace(key, config.listsEvents === true)
}

// The last handle on this key stopped: its snapshot stays as it is.
export function subscriptionStopped(name: string, params: unknown[]) {
  const key = keyOf(name, params)
  if (!live.has(key)) return
  flush()
  live.delete(key)
}

async function load(cache: CacheStore, storage: SessionOptions['storage']) {
  try {
    const rows = await cache.load()
    for (const row of rows) {
      snapshots.set(row.key, {
        eventId: row.eventId,
        docs: meteor.EJSON.parse(row.data) as Docs,
      })
    }
    const userId = snapshots.get(SESSION_KEY)?.docs.users?.[0]?._id
    const token = await storage.getItem(TOKEN_KEY)
    if (userId && token) {
      restoreSession({ userId, token })
      hydrate()
    } else if (rows.length > 0) {
      // Signed out without the wipe completing: nothing here is the
      // signed-in user's.
      snapshots.clear()
      await cache.clear()
    }
  } catch (error) {
    console.warn('Offline cache unreadable, starting empty', error)
    snapshots.clear()
    await cache.clear().catch(() => {})
  }
}

function setLoaded() {
  loaded = true
  loadedDep.changed()
  snapshotsDep.changed()
}

// Puts every snapshot's docs into the collections, marked stale.
function hydrate() {
  for (const snapshot of snapshots.values()) {
    for (const [collection, docs] of Object.entries(snapshot.docs)) {
      const target = collectionOf(collection)
      const ids = staleIn(collection)
      for (const doc of docs) {
        target.upsert(meteor.EJSON.clone(doc))
        ids.add(doc._id)
      }
    }
  }
}

function replace(key: string, listsEvents: boolean) {
  const entry = live.get(key)
  if (!entry) return
  const old = snapshots.get(key)
  const next: Snapshot = { eventId: entry.eventId, docs: entry.select() }
  snapshots.set(key, next)
  replaced.add(key)
  persist(key, next)

  const dropped = old ? [old] : []
  if (listsEvents) {
    listedEvents = new Set(
      Object.values(next.docs).flatMap(docs => docs.map(d => d._id)),
    )
    const gone: string[] = []
    for (const [other, snapshot] of snapshots) {
      if (!snapshot.eventId || listedEvents.has(snapshot.eventId)) continue
      snapshots.delete(other)
      live.delete(other)
      dropped.push(snapshot)
      gone.push(other)
    }
    if (gone.length > 0) write(s => s.remove(gone))
  }
  for (const snapshot of dropped) dropStale(snapshot)
  snapshotsDep.changed()
}

// Removes a replaced snapshot's docs that the server didn't send again,
// unless a snapshot not yet replaced on this connection still holds them.
function dropStale(snapshot: Snapshot) {
  for (const [collection, docs] of Object.entries(snapshot.docs)) {
    const ids = stale.get(collection)
    if (!ids) continue
    for (const { _id } of docs) {
      if (!ids.has(_id) || heldElsewhere(collection, _id)) continue
      ids.delete(_id)
      collectionOf(collection).del(_id)
    }
  }
}

function heldElsewhere(collection: string, id: string) {
  for (const [key, snapshot] of snapshots) {
    if (replaced.has(key)) continue
    if (snapshot.docs[collection]?.some(d => d._id === id)) return true
  }
  return false
}

// The fresh docs in `scope`, as plain copies.
function selectFresh(scope: Record<string, Selector>): Docs {
  const docs: Docs = {}
  for (const [collection, selector] of Object.entries(scope)) {
    const ids = stale.get(collection)
    docs[collection] = collectionOf(collection)
      .find(selector)
      .filter(doc => !ids?.has(doc._id))
      .map(plain)
  }
  return docs
}

function sessionDocs(userId: string): Docs {
  const user = collectionOf('users').findOne({ _id: userId })
  return { users: [user ? plain(user) : { _id: userId }] }
}

function plain(doc: Doc): Doc {
  const copy = meteor.EJSON.clone(doc)
  delete copy._version
  return copy
}

function collectionOf(name: string) {
  if (!Data.db.collections[name]) Data.db.addCollection(name)
  return Data.db.collections[name]
}

function staleIn(collection: string) {
  let ids = stale.get(collection)
  if (!ids) stale.set(collection, (ids = new Set()))
  return ids
}

function scheduleFlush() {
  if (flushTimer || live.size === 0) return
  flushTimer = setTimeout(flush, FLUSH_DELAY_MS)
}

// Brings every live snapshot up to date with the collections.
function flush() {
  if (flushTimer) clearTimeout(flushTimer)
  flushTimer = null
  for (const [key, entry] of live) {
    const docs = entry.select()
    const current = snapshots.get(key)
    if (
      current &&
      meteor.EJSON.stringify(current.docs) === meteor.EJSON.stringify(docs)
    ) {
      continue
    }
    const next = { eventId: entry.eventId, docs }
    snapshots.set(key, next)
    persist(key, next)
  }
}

function persist(key: string, snapshot: Snapshot) {
  const row = {
    key,
    eventId: snapshot.eventId,
    data: meteor.EJSON.stringify(snapshot.docs),
  }
  write(s => s.put(row))
}

// Writes run one at a time, in order.
function write(run: (s: CacheStore) => Promise<void>) {
  const target = store
  if (!target) return
  writes = writes
    .then(() => run(target))
    .catch(error => console.warn('Offline cache write failed', error))
}

// The full wipe on sign-out: the store, the snapshots and every collection.
function wipe() {
  if (flushTimer) clearTimeout(flushTimer)
  flushTimer = null
  snapshots.clear()
  live.clear()
  replaced.clear()
  stale.clear()
  listedEvents = null
  for (const collection of Object.values(Data.db.collections)) {
    collection.remove({})
  }
  snapshotsDep.changed()
  write(s => s.clear())
}

onSession({
  connected: () => {
    stale.clear()
    replaced.clear()
    live.clear()
    listedEvents = null
    hydrate()
  },
  offline: () => {
    flush()
    live.clear()
  },
  message: msg => {
    if (!msg.collection || !msg.id) return
    const ids = stale.get(msg.collection)
    if (!ids?.has(msg.id)) return
    ids.delete(msg.id)
    // Re-sent: drop the cached copy first, so the library's upsert doesn't
    // merge the fresh fields into it.
    if (msg.msg === 'added') collectionOf(msg.collection).del(msg.id)
  },
})

onLogin(() => {
  const userId = sessionUserId()
  if (!store || !userId) return
  live.set(SESSION_KEY, { eventId: null, select: () => sessionDocs(userId) })
  replaced.add(SESSION_KEY)
  flush()
})

onSessionEnd(wipe)

Data.db.on('change', scheduleFlush)
