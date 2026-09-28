import { call } from './calls'
import { Data, meteor } from './meteor'

// What the `login` DDP method resolves with.
export type LoginResult = { id: string; token: string }

// Reactive. True while the library's resume-token login is in flight.
export function loggingIn(): boolean {
  return meteor.loggingIn() === true
}

// Reactive.
export function currentUser<T>(): T | undefined {
  return (meteor.user() ?? undefined) as T | undefined
}

export function authToken(): string | null {
  return meteor.getAuthToken() ?? null
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

// Logs out on the server, then always clears the local session — as the
// library's own `logout` does — even if the server call failed. Unlike it,
// this goes through `call`, so it times out instead of hanging offline.
export async function logout(): Promise<void> {
  try {
    await call('logout')
  } finally {
    meteor.handleLogout()
  }
}
