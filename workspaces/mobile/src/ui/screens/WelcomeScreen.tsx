import { router } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LocalSvg } from 'react-native-svg/css'

import giftMarkAsset from '@/assets/svg/gift-mark.svg'
import { Text } from '@/components/ui/text'
import { GarlandButton, GarlandButtonText } from '@/ui/components/GarlandButton'
import { LanguageChangeButton } from '@/ui/components/LanguageChangeButton'

export function WelcomeScreen() {
  const { t } = useTranslation()
  return (
    <SafeAreaView className="flex-1 bg-garland-paper">
      <View className="flex-1 px-7">
        <View className="items-end py-3.5">
          <LanguageChangeButton />
        </View>
        <View className="flex-1 justify-center">
          <View className="mb-9 opacity-90">
            <LocalSvg asset={giftMarkAsset} width={44} height={44} />
          </View>
          <Text className="font-garland-display text-[44px] leading-[44px] tracking-[0.2px] text-garland-ink">
            {t('Prezentowo.')}
          </Text>
          <View className="my-6 h-0.5 w-9 bg-garland-green" />
          <Text className="max-w-[280px] text-base leading-[25px] text-garland-ink-60">
            {t('A quiet place to share gift ideas with people you love.')}
          </Text>
        </View>

        <View className="gap-3 pb-9">
          <GarlandButton onPress={() => router.push('/signin')}>
            <GarlandButtonText>{t('Get started')}</GarlandButtonText>
          </GarlandButton>
          <Text className="text-center text-xs leading-[18px] text-garland-ink-40">
            {t('Sign in or create an account — same place, no password.')}
          </Text>
        </View>
      </View>
    </SafeAreaView>
  )
}
