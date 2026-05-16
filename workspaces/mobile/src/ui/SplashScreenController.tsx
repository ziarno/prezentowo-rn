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
  const { connected } = useConnection()
  const { isLoading } = useAuth()
  const hasCompletedOnboarding = useAuthStore(s => s.hasCompletedOnboarding)
  const loadPersistedState = useAuthStore(s => s.loadPersistedState)

  useEffect(() => {
    loadPersistedState()
  }, [loadPersistedState])

  useEffect(() => {
    if (connected && !isLoading && hasCompletedOnboarding !== null && fontsLoaded) {
      setTimeout(() => {
        SplashScreen.hide()
      }, 100)
    }
  }, [connected, isLoading, hasCompletedOnboarding, fontsLoaded])

  return null
}
