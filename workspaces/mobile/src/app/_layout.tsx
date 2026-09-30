import { useFonts } from 'expo-font'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { GluestackUIProvider } from '@/components/ui/gluestack-ui-provider'
import { useMagicLinkDeepLink } from '@/hooks/useMagicLinkDeepLink'
import { usePendingInvite } from '@/hooks/usePendingInvite'
import { LanguageModalProvider } from '@/localization/LanguageModalProvider'
import { LocalizationProvider } from '@/localization/provider'
import { useAuthStore } from '@/store/useAuthStore'
import { SplashScreenController } from '@/ui/SplashScreenController'

import '../../global.css'

export default function Root() {
  const [fontsLoaded] = useFonts({
    FoglihtenNo07: require('../../assets/fonts/FoglihtenNo07.ttf'),
  })

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <GluestackUIProvider mode="light">
          <StatusBar style="dark" />
          <LocalizationProvider>
            <LanguageModalProvider>
              <SplashScreenController fontsLoaded={fontsLoaded} />
              {fontsLoaded ? <RootNavigator /> : null}
            </LanguageModalProvider>
          </LocalizationProvider>
        </GluestackUIProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}

function RootNavigator() {
  useMagicLinkDeepLink()
  const userToken = useAuthStore(s => s.userToken)
  const hasCompletedOnboarding = useAuthStore(s => s.hasCompletedOnboarding)
  const firstLoginPending = useAuthStore(s => s.firstLoginPending)

  // hasCompletedOnboarding === null means we haven't read from SecureStore yet;
  // the splash screen stays up until then, so any guard would work — but we
  // gate explicitly to avoid a one-frame flash of the wrong screen.
  const showOnboarding = hasCompletedOnboarding === false
  const showAuth = hasCompletedOnboarding === true && !userToken
  const showFirstLogin = !!userToken && firstLoginPending
  const showApp = !!userToken && !firstLoginPending
  usePendingInvite(showApp)

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'fade',
      }}
    >
      <Stack.Protected guard={showOnboarding}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>

      <Stack.Protected guard={showAuth}>
        <Stack.Screen name="welcome" />
        <Stack.Screen
          name="signin"
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="check-email"
          options={{ animation: 'slide_from_right' }}
        />
      </Stack.Protected>

      <Stack.Protected guard={showFirstLogin}>
        <Stack.Screen name="first-login" />
      </Stack.Protected>

      <Stack.Protected guard={showApp}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>

      {/* 7a invite: reachable signed in or out, so it sits outside the guards. */}
      <Stack.Screen
        name="e/[code]"
        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
      />
    </Stack>
  )
}
