import { useTranslation } from 'react-i18next'
import { View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Text } from '@/components/ui/text'
import { useAuth } from '@/hooks/useAuth'
import { GarlandButton, GarlandButtonText } from '@/ui/components/GarlandButton'
import { LanguageChangeButton } from '@/ui/components/LanguageChangeButton'

// What first-login shows after an "under 13" answer (docs/spec.md §1.15): no
// account was made, and the age was not kept. Back signs out of the dead session and
// returns to the welcome screen.
export function UnderAgeScreen() {
  const { t } = useTranslation()
  const { leaveUnderAge } = useAuth()

  return (
    <SafeAreaView className="flex-1 bg-garland-paper">
      <View className="flex-1 px-7">
        <View className="flex-row items-center justify-end py-3.5">
          <LanguageChangeButton />
        </View>

        <View className="pt-1.5">
          <Text className="font-garland-display text-[34px] leading-[35px] text-garland-ink">
            {t('underAge.title')}
          </Text>
          <Text className="mt-2.5 text-sm leading-[21px] text-garland-ink-60">
            {t('underAge.body')}
          </Text>
        </View>

        <View className="flex-1" />

        <View className="pb-9">
          <GarlandButton onPress={leaveUnderAge}>
            <GarlandButtonText>{t('underAge.back')}</GarlandButtonText>
          </GarlandButton>
        </View>
      </View>
    </SafeAreaView>
  )
}
