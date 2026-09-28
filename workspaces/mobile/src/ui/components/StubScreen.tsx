import { useTranslation } from 'react-i18next'
import { View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Text } from '@/components/ui/text'
import { ScreenHeader } from '@/ui/components/ScreenHeader'

// Placeholder body for a route whose feature slice hasn't landed yet: the real
// header (so navigation and the drawer work end to end) over an empty page.
export function StubScreen({
  title,
  variant,
}: {
  title: string
  variant?: 'drawer' | 'modal'
}) {
  const { t } = useTranslation()
  return (
    <SafeAreaView className="flex-1 bg-garland-paper">
      <ScreenHeader title={title} variant={variant} />
      <View className="flex-1 items-center justify-center px-[22px]">
        <Text className="text-sm text-garland-ink-60">
          {t('shell.comingSoon')}
        </Text>
      </View>
    </SafeAreaView>
  )
}
