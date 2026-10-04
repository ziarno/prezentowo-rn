import { useEffect } from 'react'

import { chatSession } from '@/chat'
import { useAuthStore } from '@/store/useAuthStore'
import {
  type LoginResult,
  type MeteorError,
  type NetworkError,
  call,
  completeLogin,
  loggingIn,
  logout,
  sessionToken,
  useTracker,
} from '@/sync'

// Calls reject with the server's error, or a `NetworkError` when the server
// couldn't be reached in time.
export type AuthError = MeteorError | NetworkError

type RequestMagicLinkParams = {
  email: string
  onSuccess: () => void
  onError: (err: AuthError) => void
}

type LoginWithMagicTokenParams = {
  email: string
  token: string
  onSuccess: () => void
  onError: (err: AuthError) => void
}

type LoginWithDevAccountParams = {
  onError: (err: AuthError) => void
}

type SignOutParams = {
  onError: (err: AuthError) => void
}

const normalizeEmail = (email: string) => email.trim().toLowerCase()
const normalizeToken = (token: string) => token.trim().toUpperCase()

export const useAuth = () => {
  const setUserToken = useAuthStore(s => s.setUserToken)
  const setPendingEmail = useAuthStore(s => s.setPendingEmail)
  const isLoading = useTracker(() => loggingIn())
  // Signed in on this connection, or restored from the offline cache — so an
  // offline cold start opens signed in. Null once the session ends, including
  // when the server rejects the stored token.
  const token = useTracker(() => sessionToken())

  useEffect(() => setUserToken(token), [token, setUserToken])

  return {
    isLoading,
    requestMagicLink: ({
      email,
      onSuccess,
      onError,
    }: RequestMagicLinkParams) => {
      const normalized = normalizeEmail(email)
      setPendingEmail(normalized)
      call('requestMagicLink', { email: normalized }).then(onSuccess, onError)
    },
    // Finish the passwordless flow: hand the 6-digit token + email back to
    // accounts-passwordless via the standard `login` DDP method. On success
    // `completeLogin` saves the auth token, which `sessionToken` then reports
    // to our Zustand store.
    loginWithMagicToken: ({
      email,
      token,
      onSuccess,
      onError,
    }: LoginWithMagicTokenParams) => {
      call<LoginResult>('login', {
        selector: { email: normalizeEmail(email) },
        token: normalizeToken(token),
      }).then(result => {
        completeLogin(result)
        onSuccess()
      }, onError)
    },
    // Development only: the backend registers a `{ devLogin: true }` login
    // handler under `Meteor.isDevelopment` that signs in as a fixed dev user
    // whose name is already set, so first-login is skipped.
    loginWithDevAccount: ({ onError }: LoginWithDevAccountParams) => {
      call<LoginResult>('login', { devLogin: true }).then(
        completeLogin,
        onError,
      )
    },
    // The local session is cleared even when the server call fails.
    signOut: ({ onError }: SignOutParams) => {
      chatSession.end()
      logout().then(
        () => setUserToken(null),
        err => {
          setUserToken(null)
          onError(err)
        },
      )
    },
  }
}
