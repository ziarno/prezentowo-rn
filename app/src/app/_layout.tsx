import { Stack } from 'expo-router'

import { GluestackUIProvider } from '@/components/ui/gluestack-ui-provider'
import { SplashScreenController } from '@/components/SplashScreenController'
import { useConnection } from '@/hooks/useConnection'
import { useAuthStore } from '@/store/useAuthStore'

import '../../global.css'

export default function Root() {
  useConnection()
  return (
    <GluestackUIProvider mode="light">
      <SplashScreenController />
      <RootNavigator />
    </GluestackUIProvider>
  )
}

function RootNavigator() {
  const userToken = useAuthStore(s => s.userToken)
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'none',
      }}
    >
      <Stack.Protected guard={!!userToken}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>

      <Stack.Protected guard={!userToken}>
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
      </Stack.Protected>
    </Stack>
  )
}
