import { StatusBar } from 'expo-status-bar'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { View } from 'react-native'
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context'

import { Text } from '@/components/ui/text'
import { useOffline } from '@/hooks/useOffline'

// Variant A's banner (docs/spec.md §6.4): an ink strip under the status bar
// that pushes the screens below it down while offline. The screens get a
// provider of their own: a SafeAreaView takes its nearest provider's insets,
// and this one, starting under the banner, has no top inset to add again.
export function OfflineBanner({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const offline = useOffline()
  const insets = useSafeAreaInsets()

  return (
    <View className="flex-1">
      {offline ? (
        <View
          style={{ paddingTop: insets.top }}
          className="bg-garland-ink"
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
        >
          <StatusBar style="light" />
          <View className="flex-row items-center gap-2 px-4 py-[7px]">
            <View className="h-[7px] w-[7px] rounded-full bg-garland-amber" />
            <Text className="text-xs text-garland-paper">
              {t('offline.banner')}
            </Text>
          </View>
        </View>
      ) : null}
      <SafeAreaProvider>{children}</SafeAreaProvider>
    </View>
  )
}
