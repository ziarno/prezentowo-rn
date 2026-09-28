import Meteor, { type MeteorError } from '@meteorrn/core'
import { useCallback, useEffect } from 'react'

import { useAuthStore } from '@/store/useAuthStore'

type RequestMagicLinkParams = {
  email: string
  onSuccess: () => void
  onError: (err: MeteorError) => void
}

type LoginWithMagicTokenParams = {
  email: string
  token: string
  onSuccess: () => void
  onError: (err: MeteorError) => void
}

type LoginWithDevAccountParams = {
  onError: (err: MeteorError) => void
}

// What the `login` DDP method resolves with.
type LoginResult = { id: string; token: string }

type SignOutParams = {
  onError: (err: MeteorError) => void
}

const Data = Meteor.getData()

const normalizeEmail = (email: string) => email.trim().toLowerCase()
const normalizeToken = (token: string) => token.trim().toUpperCase()

export const useAuth = () => {
  const setUserToken = useAuthStore(s => s.setUserToken)
  const setPendingEmail = useAuthStore(s => s.setPendingEmail)
  const isLoading = Meteor.useTracker(() => Meteor.loggingIn() === true)

  const onLogin = useCallback(() => {
    setUserToken(Meteor.getAuthToken())
  }, [setUserToken])

  useEffect(() => {
    Data.on('onLogin', onLogin)
    return () => Data.off('onLogin', onLogin)
  }, [onLogin])

  return {
    isLoading,
    requestMagicLink: ({
      email,
      onSuccess,
      onError,
    }: RequestMagicLinkParams) => {
      const normalized = normalizeEmail(email)
      setPendingEmail(normalized)
      Meteor.call(
        'requestMagicLink',
        { email: normalized },
        (err: MeteorError | undefined) => {
          if (err) return onError(err)
          onSuccess()
        },
      )
    },
    // Finish the passwordless flow: hand the 6-digit token + email back to
    // accounts-passwordless via the standard `login` DDP method. On success
    // `_handleLoginCallback` saves the auth token and fires `onLogin`, which
    // writes the token to our Zustand store.
    loginWithMagicToken: ({
      email,
      token,
      onSuccess,
      onError,
    }: LoginWithMagicTokenParams) => {
      Meteor.call(
        'login',
        {
          selector: { email: normalizeEmail(email) },
          token: normalizeToken(token),
        },
        (err: MeteorError | undefined, result: LoginResult) => {
          if (err) return onError(err)
          Meteor._handleLoginCallback(null, result)
          onSuccess()
        },
      )
    },
    // Development only: the backend registers a `{ devLogin: true }` login
    // handler under `Meteor.isDevelopment` that signs in as a fixed dev user
    // whose name is already set, so first-login is skipped.
    loginWithDevAccount: ({ onError }: LoginWithDevAccountParams) => {
      Meteor.call(
        'login',
        { devLogin: true },
        (err: MeteorError | undefined, result: LoginResult) => {
          if (err) return onError(err)
          Meteor._handleLoginCallback(null, result)
        },
      )
    },
    signOut: ({ onError }: SignOutParams) => {
      Meteor.logout(err => {
        if (err) {
          return onError(err as MeteorError)
        }
        setUserToken(null)
      })
    },
  }
}
