import Meteor, { type MeteorError } from '@meteorrn/core'
import { useCallback, useEffect } from 'react'

import { useAuthStore } from '@/store/useAuthStore'

type RequestMagicLinkParams = {
  email: string
  onSuccess: () => void
  onError: (err: MeteorError) => void
}

type SignOutParams = {
  onError: (err: MeteorError) => void
}

const Data = Meteor.getData()

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
    // Passwordless: ask the backend to email a magic link, then hand off to
    // the "check your email" screen. The backend method does not exist yet —
    // the call falls through to onSuccess so the UI can be exercised end-to-end.
    // TODO: implement `requestMagicLink` on the Meteor side and remove the
    // fallback below once it lands.
    requestMagicLink: ({
      email,
      onSuccess,
      onError,
    }: RequestMagicLinkParams) => {
      setPendingEmail(email)
      Meteor.call(
        'requestMagicLink',
        { email },
        (err: MeteorError | undefined) => {
          // 404 = method not registered on the backend yet; let dev exercise
          // the UI in that case.
          if (err && String(err.error) !== '404') return onError(err)
          onSuccess()
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
