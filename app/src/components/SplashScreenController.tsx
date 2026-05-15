import { SplashScreen } from 'expo-router'
import { useEffect } from 'react'

import { useAuth } from '@/hooks/useAuth'
import { useConnection } from '@/hooks/useConnection'

SplashScreen.preventAutoHideAsync()

export function SplashScreenController() {
  const { connected } = useConnection()
  const { isLoading } = useAuth()

  useEffect(() => {
    if (connected && !isLoading) {
      setTimeout(() => {
        SplashScreen.hide()
      }, 100)
    }
  }, [connected, isLoading])

  return null
}
