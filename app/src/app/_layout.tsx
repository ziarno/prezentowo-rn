import { Stack, useRouter, useSegments } from 'expo-router'
import { useEffect } from 'react'

import { useAuthStore } from '@/store/useAuthStore'
import { useConnection } from '@/hooks/useConnection'

const AUTH_SCREENS = ['login', 'register']

export default function RootLayout() {
  const { connected } = useConnection()
  const userToken = useAuthStore(s => s.userToken)
  const segments = useSegments()
  const router = useRouter()

  useEffect(() => {
    if (!connected) return

    const onAuthScreen = AUTH_SCREENS.includes(segments[0] as string)

    if (!userToken && !onAuthScreen) {
      router.replace('/login')
    } else if (userToken && onAuthScreen) {
      router.replace('/')
    }
  }, [connected, userToken, segments])

  return <Stack screenOptions={{ headerShown: false }} />
}
