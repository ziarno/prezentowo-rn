import { SplashScreen } from 'expo-router'
import { useEffect, useState } from 'react'

import { useAccountStage } from '@/hooks/useAccountStage'
import { useAuth } from '@/hooks/useAuth'
// Opens the connection (and the offline cache) at app start.
import '@/hooks/useConnection'
import { loadLastEvent } from '@/store/lastEvent'
import { useAuthStore } from '@/store/useAuthStore'
import { cacheReady, sessionToken, useTracker } from '@/sync'

SplashScreen.preventAutoHideAsync()

// True once fonts, onboarding state, the last open event, the offline cache
// and the signed-in user's document are ready — not the server: an offline cold start renders
// from the cache. Stays true from then on, so a later sign-in waiting for its
// user document doesn't unmount the app.
export function useLaunchReady(fontsLoaded: boolean): boolean {
  const { isLoading } = useAuth()
  const cacheLoaded = useTracker(() => cacheReady())
  const token = useTracker(() => sessionToken())
  // Nothing cached to open with, but the stored login is being resumed.
  const resuming = isLoading && !token
  // Signed in, but whether they still need a name isn't known yet.
  const stage = useAccountStage()
  const hasCompletedOnboarding = useAuthStore(s => s.hasCompletedOnboarding)
  const loadPersistedState = useAuthStore(s => s.loadPersistedState)
  const [lastEventLoaded, setLastEventLoaded] = useState(false)
  const [launched, setLaunched] = useState(false)

  useEffect(() => {
    loadPersistedState()
  }, [loadPersistedState])

  useEffect(() => {
    loadLastEvent().then(() => setLastEventLoaded(true))
  }, [])

  const ready =
    cacheLoaded &&
    !resuming &&
    stage !== 'loading' &&
    hasCompletedOnboarding !== null &&
    lastEventLoaded &&
    fontsLoaded
  if (ready && !launched) setLaunched(true)
  return ready || launched
}

type Props = {
  ready: boolean
}

// The native splash covers a cold start, but not a reload in development —
// so the root also renders nothing until `useLaunchReady`.
export function SplashScreenController({ ready }: Props) {
  useEffect(() => {
    if (ready) {
      setTimeout(() => {
        SplashScreen.hide()
      }, 100)
    }
  }, [ready])

  return null
}
