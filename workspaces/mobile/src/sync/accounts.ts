import { call } from './calls'
import { Data, meteor } from './meteor'

// What the `login` DDP method resolves with.
export type LoginResult = { id: string; token: string }

export type Session = { userId: string; token: string }

// The session the cache remembered from the last run, until the library's
// own resume login replaces it or the session ends. It lets an offline cold
// start open signed in.
let restored: Session | null = null
let signedIn = false
const sessionDep = new meteor.Tracker.Dependency()
const endListeners: (() => void)[] = []

// Reactive. True while the library's resume-token login is in flight.
export function loggingIn(): boolean {
  return meteor.loggingIn() === true
}

// Reactive. The signed-in user: logged in on this connection, or restored
// from the cache.
export function sessionUserId(): string | null {
  sessionDep.depend()
  return meteor._reactiveDict.get('_userIdSaved') ?? restored?.userId ?? null
}

// Reactive. The resume token of the signed-in session, or null when signed
// out.
export function sessionToken(): string | null {
  if (!sessionUserId()) return null
  return meteor.getAuthToken() ?? restored?.token ?? null
}

// Reactive.
export function currentUser<T>(): T | undefined {
  const userId = sessionUserId()
  return userId ? findUser<T>(userId) : undefined
}

export function authToken(): string | null {
  return meteor.getAuthToken() ?? restored?.token ?? null
}

// Any user document the client holds (`Meteor.users`).
export function findUser<T>(userId: string): T | undefined {
  return (meteor.users.findOne(userId) ?? undefined) as T | undefined
}

// Stores the token and user from a successful `login` call and fires the
// `onLogin` listeners.
export function completeLogin(result: LoginResult) {
  meteor._handleLoginCallback(null, result)
}

export function onLogin(listener: () => void): () => void {
  Data.on('onLogin', listener)
  return () => Data.off('onLogin', listener)
}

// Fires once per session, when it ends: a sign-out, or the server rejecting
// the stored token.
export function onSessionEnd(listener: () => void) {
  endListeners.push(listener)
}

export function restoreSession(session: Session) {
  restored = session
  signedIn = true
  sessionDep.changed()
}

// Logs out on the server, then always clears the local session — as the
// library's own `logout` does — even if the server call failed. Unlike it,
// this goes through `call`, so it times out instead of hanging offline.
export async function logout(): Promise<void> {
  try {
    await call('logout')
  } finally {
    meteor.handleLogout()
    endSession()
  }
}

function endSession() {
  restored = null
  sessionDep.changed()
  if (!signedIn) return
  signedIn = false
  for (const listener of endListeners) listener()
}

Data.on('onLogin', () => {
  signedIn = true
  sessionDep.changed()
})
// The library logs out by itself when the server rejects the resume token.
Data.on('loggingOut', () => {
  if (!meteor.loggingOut() && !meteor.getAuthToken()) endSession()
})
