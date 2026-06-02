import { router } from 'expo-router'
import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dimensions,
  FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { ArrowRightIcon } from '@/components/ui/icon'
import { Text } from '@/components/ui/text'
import { garland } from '@/constants/colors'
import { useAuthStore } from '@/store/useAuthStore'
import { GarlandButton, GarlandButtonText } from '@/ui/components/GarlandButton'
import { LanguageChangeButton } from '@/ui/components/LanguageChangeButton'
import { OnboardingIllustration } from '@/ui/components/OnboardingIllustration'
import { PageDots } from '@/ui/components/PageDots'

type Page = {
  eyebrow: string
  title: [string, string]
  body: string
  illu: 'intro' | 'wishlist' | 'claim'
}

export function OnboardingScreen() {
  const width = Dimensions.get('window').width
  const { t } = useTranslation()
  const pages: Page[] = [
    {
      eyebrow: t('onboarding.page1.eyebrow'),
      title: [
        t('onboarding.page1.titleLine1'),
        t('onboarding.page1.titleLine2'),
      ],
      body: t('onboarding.page1.body'),
      illu: 'intro',
    },
    {
      eyebrow: t('onboarding.page2.eyebrow'),
      title: [
        t('onboarding.page2.titleLine1'),
        t('onboarding.page2.titleLine2'),
      ],
      body: t('onboarding.page2.body'),
      illu: 'wishlist',
    },
    {
      eyebrow: t('onboarding.page3.eyebrow'),
      title: [
        t('onboarding.page3.titleLine1'),
        t('onboarding.page3.titleLine2'),
      ],
      body: t('onboarding.page3.body'),
      illu: 'claim',
    },
  ]
  const [step, setStep] = useState(0)
  const listRef = useRef<FlatList<Page>>(null)
  const completeOnboarding = useAuthStore(s => s.completeOnboarding)

  const finish = useCallback(async () => {
    await completeOnboarding()
    router.replace('/welcome')
  }, [completeOnboarding])

  const advance = () => {
    if (step >= pages.length - 1) {
      finish()
      return
    }
    const next = step + 1
    listRef.current?.scrollToIndex({ index: next, animated: true })
    setStep(next)
  }

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / width)
    if (next !== step) setStep(next)
  }

  return (
    <SafeAreaView className="flex-1 bg-garland-paper">
      <View className="flex-row items-center justify-between px-7 pt-1">
        <Text className="text-xs font-bold uppercase tracking-[1px] text-garland-ink-40">
          {pages[step].eyebrow}
        </Text>
        <View className="flex-row items-center gap-3">
          <LanguageChangeButton />
          <GarlandButton variant="link" onPress={finish}>
            <GarlandButtonText>{t('common.skip')}</GarlandButtonText>
          </GarlandButton>
        </View>
      </View>

      <FlatList
        ref={listRef}
        data={pages}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={p => p.illu}
        onMomentumScrollEnd={onScrollEnd}
        renderItem={({ item }) => (
          <View style={{ width }} className="flex-1 justify-center px-7">
            <View className="mb-7 h-[220px] items-center justify-center">
              <OnboardingIllustration kind={item.illu} />
            </View>
            <Text className="font-garland-display text-[36px] leading-[36px] text-garland-ink">
              {item.title[0]}
              {'\n'}
              {item.title[1]}
            </Text>
            <Text className="mt-4 text-base leading-[25px] text-garland-ink-60">
              {item.body}
            </Text>
          </View>
        )}
      />

      <View className="flex-row items-center justify-between px-7 pb-9">
        <PageDots count={pages.length} activeIndex={step} />
        <GarlandButton onPress={advance} className="gap-1.5 px-[22px] py-3">
          <GarlandButtonText>
            {step === pages.length - 1
              ? t('common.getStarted')
              : t('common.continue')}
          </GarlandButtonText>
          <ArrowRightIcon width={18} height={18} color={garland.paper} />
        </GarlandButton>
      </View>
    </SafeAreaView>
  )
}
