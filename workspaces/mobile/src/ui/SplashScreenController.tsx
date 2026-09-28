import { SplashScreen } from 'expo-router'
import { useEffect } from 'react'

import { useAuth } from '@/hooks/useAuth'
import { useConnection } from '@/hooks/useConnection'
import { useAuthStore } from '@/store/useAuthStore'

SplashScreen.preventAutoHideAsync()

type Props = {
  fontsLoaded: boolean
}

export function SplashScreenController({ fontsLoaded }: Props) {
  const { status } = useConnection()
  const { isLoading } = useAuth()
  const hasCompletedOnboarding = useAuthStore(s => s.hasCompletedOnboarding)
  const loadPersistedState = useAuthStore(s => s.loadPersistedState)

  useEffect(() => {
    loadPersistedState()
  }, [loadPersistedState])

  useEffect(() => {
    if (
      status === 'connected' &&
      !isLoading &&
      hasCompletedOnboarding !== null &&
      fontsLoaded
    ) {
      setTimeout(() => {
        SplashScreen.hide()
      }, 100)
    }
  }, [status, isLoading, hasCompletedOnboarding, fontsLoaded])

  return null
}
