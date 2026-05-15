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

import { OnboardingIllustration } from '@/components/screens/OnboardingIllustration'
import { Text } from '@/components/ui/text'
import { displayFont, garland } from '@/constants/garland'
import { useAuthStore } from '@/store/useAuthStore'

type Page = {
  eyebrow: string
  title: [string, string]
  body: string
  illu: 'intro' | 'wishlist' | 'claim'
}

const PAGES: Page[] = [
  {
    eyebrow: '01 · 03',
    title: ['Wishlists,', 'not guesswork.'],
    body: "Prezentowo is a quiet place to share what you'd love this Christmas — so the people you love can stop guessing.",
    illu: 'intro',
  },
  {
    eyebrow: '02 · 03',
    title: ['Build', 'your list.'],
    body: 'Add gift ideas as you stumble on them. Links, photos, a quick note about size or colour — anything that helps.',
    illu: 'wishlist',
  },
  {
    eyebrow: '03 · 03',
    title: ['Claim', 'quietly.'],
    body: "When you reserve a gift for someone, only the other givers see it. The person it's for never finds out.",
    illu: 'claim',
  },
]

export function OnboardingScreen() {
  const width = Dimensions.get('window').width
  const [step, setStep] = useState(0)
  const listRef = useRef<FlatList<Page>>(null)
  const completeOnboarding = useAuthStore(s => s.completeOnboarding)

  const finish = useCallback(async () => {
    await completeOnboarding()
    router.replace('/welcome')
  }, [completeOnboarding])

  const advance = () => {
    if (step >= PAGES.length - 1) {
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
    <SafeAreaView className="flex-1" style={{ backgroundColor: garland.paper }}>
      <View className="flex-row items-center justify-between px-7 pt-1">
        <Text
          className="font-bold uppercase"
          style={{ fontSize: 12, color: garland.ink40, letterSpacing: 1 }}
        >
          {PAGES[step].eyebrow}
        </Text>
        <Pressable onPress={finish} hitSlop={12}>
          <Text style={{ fontSize: 13, color: garland.ink60 }}>Skip</Text>
        </Pressable>
      </View>

      <FlatList
        ref={listRef}
        data={PAGES}
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
            <Text
              style={{
                fontFamily: displayFont,
                fontSize: 36,
                lineHeight: 36,
                color: garland.ink,
              }}
            >
              {item.title[0]}
              {'\n'}
              {item.title[1]}
            </Text>
            <Text
              className="mt-4"
              style={{ fontSize: 16, lineHeight: 25, color: garland.ink60 }}
            >
              {item.body}
            </Text>
          </View>
        )}
      />

      <View className="flex-row items-center justify-between px-7 pb-9">
        <View className="flex-row gap-1.5">
          {PAGES.map((_, n) => (
            <View
              key={n}
              style={{
                width: n === step ? 24 : 6,
                height: 6,
                borderRadius: 999,
                backgroundColor: n === step ? garland.green : garland.ink15,
              }}
            />
          ))}
        </View>
        <Pressable
          onPress={advance}
          style={{
            backgroundColor: garland.ink,
            borderRadius: 999,
            paddingVertical: 12,
            paddingHorizontal: 22,
          }}
        >
          <Text
            style={{ color: garland.paper, fontSize: 15, fontWeight: '600' }}
          >
            {step === PAGES.length - 1 ? 'Get started →' : 'Continue →'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  )
}
