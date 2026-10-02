import Meteor, { Mongo } from '@meteorrn/core'

// The library's untyped and private surface that the layer relies on, named
// in one place. Checked against @meteorrn/core@2.9.1 (src/Meteor.js, Data.js,
// user/User.js, lib/ddp.js, lib/socket.js).

export type DdpMessage = {
  msg: string
  id?: string
  subs?: string[]
  error?: unknown
  // `added` / `changed` / `removed`
  collection?: string
}

type DdpEvent =
  | 'connected'
  | 'disconnected'
  | 'ready'
  | 'nosub'
  | 'added'
  | 'changed'
  | 'removed'

export type Ddp = {
  status: 'connected' | 'disconnected'
  socket: {
    // Set by `socket.close()`; `send` silently drops messages while it's true.
    closing?: boolean
    rawSocket: { readyState: number } | null
  }
  on(event: DdpEvent, listener: (msg: DdpMessage) => void): void
  method(name: string, params: unknown[]): string
  sub(name: string, params: unknown[]): string
  unsub(id: string): string
  disconnect(): void
}

type Dependency = { depend(): void; changed(): void }

export type Doc = { _id: string; [field: string]: unknown }

// A @meteorrn/minimongo collection. `upsert` merges into an existing doc, and
// every stored doc carries an extra `_version`.
type MinimongoCollection = {
  find(selector: object): Doc[]
  findOne(selector: object): Doc | null
  upsert(doc: Doc): void
  del(id: string): void
  remove(selector: object): void
}

type Minimongo = {
  collections: Record<string, MinimongoCollection>
  addCollection(name: string): void
  on(event: 'change', listener: () => void): void
}

type LibraryData = {
  ddp: Ddp | null
  // Where every collection's docs live. The library wipes all but its
  // unnamed local ones (the app has none) whenever a connection comes up.
  db: Minimongo
  // Outstanding method calls. The library's `result` handler looks the id up
  // here, calls the callback and splices the entry out itself. Nothing in the
  // library settles or prunes them when the connection closes.
  calls: { id: string; callback?: (error: unknown, result: unknown) => void }[]
  on(event: string, listener: () => void): void
  off(event: string, listener: () => void): void
}

type Internals = {
  connect(endpoint: string, options: Record<string, unknown>): void
  disconnect(): void
  getData(): LibraryData
  loggingIn(): boolean | undefined
  user(): unknown
  getAuthToken(): string | null
  loggingOut(): boolean
  // Shared with the accounts mixin. `_userIdSaved` is set by a successful
  // login and cleared by `handleLogout`.
  _reactiveDict: { get(key: '_userIdSaved'): string | null | undefined }
  EJSON: {
    stringify(value: unknown): string
    parse(text: string): unknown
    clone<T>(value: T): T
  }
  users: { findOne(selector: string): unknown }
  Tracker: { Dependency: new () => Dependency }
  useTracker<T>(fn: () => T, deps?: readonly unknown[]): T
  _handleLoginCallback(error: null, result: { id: string; token: string }): void
  // Clears the stored token and the logged-in user, locally only.
  handleLogout(): void
}

// Where the library keeps the resume token in the `storage` it was given.
export const TOKEN_KEY = 'reactnativemeteor_usertoken'

export const meteor = Meteor as unknown as Internals
export const Data = meteor.getData()
export { Mongo }
