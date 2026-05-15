import { useLingui } from '@lingui/react/macro'
import { router } from 'expo-router'
import { useCallback, useRef, useState } from 'react'
import {
  Dimensions,
  FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Text } from '@/components/ui/text'
import { useAuthStore } from '@/store/useAuthStore'
import { OnboardingIllustration } from '@/ui/components/OnboardingIllustration'

type Page = {
  eyebrow: string
  title: [string, string]
  body: string
  illu: 'intro' | 'wishlist' | 'claim'
}

export function OnboardingScreen() {
  const width = Dimensions.get('window').width
  const { t } = useLingui()
  const pages: Page[] = [
    {
      eyebrow: t`01 · 03`,
      title: [t`Wishlists,`, t`not guesswork.`],
      body: t`Prezentowo is a quiet place to share what you'd love this Christmas — so the people you love can stop guessing.`,
      illu: 'intro',
    },
    {
      eyebrow: t`02 · 03`,
      title: [t`Build`, t`your list.`],
      body: t`Add gift ideas as you stumble on them. Links, photos, a quick note about size or colour — anything that helps.`,
      illu: 'wishlist',
    },
    {
      eyebrow: t`03 · 03`,
      title: [t`Claim`, t`quietly.`],
      body: t`When you reserve a gift for someone, only the other givers see it. The person it's for never finds out.`,
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
        <Pressable onPress={finish} hitSlop={12}>
          <Text className="text-[13px] text-garland-ink-60">{t`Skip`}</Text>
        </Pressable>
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
        <View className="flex-row gap-1.5">
          {pages.map((_, n) => (
            <View
              key={n}
              className={`h-1.5 rounded-full ${
                n === step ? 'w-6 bg-garland-green' : 'w-1.5 bg-garland-ink-15'
              }`}
            />
          ))}
        </View>
        <Pressable
          onPress={advance}
          className="rounded-full bg-garland-ink px-[22px] py-3"
        >
          <Text className="text-[15px] font-semibold text-garland-paper">
            {step === pages.length - 1 ? t`Get started →` : t`Continue →`}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  )
}
