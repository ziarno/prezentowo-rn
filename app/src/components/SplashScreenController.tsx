import { SplashScreen } from 'expo-router'
import { useEffect } from 'react'

import { useConnection } from '@/hooks/useConnection'
import { useAuthStore } from '@/store/useAuthStore'

SplashScreen.preventAutoHideAsync()

export function SplashScreenController() {
  const { connected } = useConnection()
  const isLoading = useAuthStore(s => s.isLoading)

  useEffect(() => {
    if (connected && !isLoading) {
      setTimeout(() => {
        SplashScreen.hide()
      }, 100)
    }
  }, [connected, isLoading])

  return null
}
