import Meteor, { type MeteorError } from '@meteorrn/core'
import type { LoginCredentials, RegisterNewUserArgs } from '@prezentowo/types'
import { useEffect } from 'react'

import { useAuthStore } from '@/store/useAuthStore'

type SignInParams = {
  email: string
  password: string
  onError: (err: MeteorError) => void
}

type SignOutParams = {
  onError: (err: MeteorError) => void
}

type RegisterParams = RegisterNewUserArgs & {
  onError: (err: MeteorError) => void
}

const Data = Meteor.getData()

export const useAuth = () => {
  const setUserToken = useAuthStore(s => s.setUserToken)
  const setIsLoading = useAuthStore(s => s.setLoading)
  const isLoading = useAuthStore(s => s.isLoading)

  function onLogin() {
    setUserToken(Meteor.getAuthToken())
  }

  useEffect(() => {
    Data.on('onLogin', onLogin)
    return () => Data.off('onLogin', onLogin)
  }, [])

  Meteor.useTracker(() => {
    setIsLoading(Meteor.loggingIn() === true)
  })

  return {
    isLoading,
    signIn: ({ email, password, onError }: SignInParams) => {
      Meteor.loginWithPassword(email, password, err => {
        if (err) {
          return onError(err)
        }
        onLogin()
      })
    },
    signOut: ({ onError }: SignOutParams) => {
      Meteor.logout(err => {
        if (err) {
          return onError(err as MeteorError)
        }
        setUserToken(null)
      })
    },
    register: ({ email, password, name, onError }: RegisterParams) => {
      Meteor.call(
        'registerNewUser',
        { email, password, name },
        (err: MeteorError, credentials: LoginCredentials) => {
          if (err) {
            return onError(err)
          }
          Meteor._handleLoginCallback(null, credentials)
          onLogin()
        },
      )
    },
  }
}
