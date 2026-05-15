import { router } from 'expo-router'
import { Pressable, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LocalSvg } from 'react-native-svg/css'

import giftMarkAsset from '@/assets/svg/gift-mark.svg'
import { Text } from '@/components/ui/text'

export function WelcomeScreen() {
  return (
    <SafeAreaView className="flex-1 bg-garland-paper">
      <View className="flex-1 px-7">
        <View className="flex-1 justify-center">
          <View className="mb-9 opacity-90">
            <LocalSvg asset={giftMarkAsset} width={44} height={44} />
          </View>
          <Text className="font-garland-display text-[44px] leading-[44px] tracking-[0.2px] text-garland-ink">
            Prezentowo.
          </Text>
          <View className="my-6 h-0.5 w-9 bg-garland-green" />
          <Text className="max-w-[280px] text-base leading-[25px] text-garland-ink-60">
            A quiet place to share gift ideas with people you love.
          </Text>
        </View>

        <View className="gap-3 pb-9">
          <Pressable
            onPress={() => router.push('/signin')}
            className="rounded-full bg-garland-ink px-[18px] py-[15px]"
          >
            <Text className="text-center text-base font-semibold text-garland-paper">
              Get started
            </Text>
          </Pressable>
          <Text className="text-center text-xs leading-[18px] text-garland-ink-40">
            Sign in or create an account — same place, no password.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  )
}
