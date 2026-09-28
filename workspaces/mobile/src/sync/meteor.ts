import Meteor, { Mongo } from '@meteorrn/core'

// The library's untyped and private surface that the layer relies on, named
// in one place. Checked against @meteorrn/core@2.9.1 (src/Meteor.js, Data.js,
// user/User.js, lib/ddp.js, lib/socket.js).

export type DdpMessage = {
  msg: string
  id?: string
  subs?: string[]
  error?: unknown
}

type DdpEvent = 'connected' | 'disconnected' | 'ready' | 'nosub'

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

type LibraryData = {
  ddp: Ddp | null
  // Outstanding method calls. The library's `result` handler looks the id up
  // here, calls the callback and splices the entry out itself.
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
  users: { findOne(selector: string): unknown }
  Tracker: { Dependency: new () => Dependency }
  useTracker<T>(fn: () => T, deps?: readonly unknown[]): T
  _handleLoginCallback(error: null, result: { id: string; token: string }): void
  // Clears the stored token and the logged-in user, locally only.
  handleLogout(): void
}

export const meteor = Meteor as unknown as Internals
export const Data = meteor.getData()
export { Mongo }
