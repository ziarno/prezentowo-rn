import { SplashScreen } from 'expo-router'
import { useEffect } from 'react'

import { useAuth } from '@/hooks/useAuth'
// Opens the connection (and the offline cache) at app start.
import '@/hooks/useConnection'
import { useAuthStore } from '@/store/useAuthStore'
import { cacheReady, useTracker } from '@/sync'

SplashScreen.preventAutoHideAsync()

type Props = {
  fontsLoaded: boolean
}

// Holds until fonts, onboarding state and the offline cache are ready — not
// for the server: an offline cold start renders from the cache.
export function SplashScreenController({ fontsLoaded }: Props) {
  // Mounted for the session-to-store wiring it does.
  const { isLoading } = useAuth()
  const cacheLoaded = useTracker(() => cacheReady())
  const token = useAuthStore(s => s.userToken)
  // Nothing cached to open with, but the stored login is being resumed.
  const resuming = isLoading && !token
  const hasCompletedOnboarding = useAuthStore(s => s.hasCompletedOnboarding)
  const loadPersistedState = useAuthStore(s => s.loadPersistedState)

  useEffect(() => {
    loadPersistedState()
  }, [loadPersistedState])

  useEffect(() => {
    if (
      cacheLoaded &&
      !resuming &&
      hasCompletedOnboarding !== null &&
      fontsLoaded
    ) {
      setTimeout(() => {
        SplashScreen.hide()
      }, 100)
    }
  }, [cacheLoaded, resuming, hasCompletedOnboarding, fontsLoaded])

  return null
}
