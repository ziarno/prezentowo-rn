import { router } from 'expo-router'
import { Pressable, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Svg, { Path, Rect } from 'react-native-svg'

import { Text } from '@/components/ui/text'
import { displayFont, garland } from '@/constants/garland'

function GiftMark() {
  return (
    <Svg
      width={44}
      height={44}
      viewBox="0 0 24 24"
      fill="none"
      stroke={garland.green}
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M20 12v9H4v-9" />
      <Rect x={2} y={7} width={20} height={5} rx={1} />
      <Path d="M12 22V7M12 7c-1 0-3.5-.5-3.5-2.5S10 2.5 12 7zM12 7c1 0 3.5-.5 3.5-2.5S14 2.5 12 7z" />
    </Svg>
  )
}

export function WelcomeScreen() {
  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: garland.paper }}>
      <View className="flex-1 px-7">
        <View className="flex-1 justify-center">
          <View className="mb-9 opacity-90">
            <GiftMark />
          </View>
          <Text
            style={{
              fontFamily: displayFont,
              fontSize: 44,
              lineHeight: 44,
              color: garland.ink,
              letterSpacing: 0.2,
            }}
          >
            Prezentowo.
          </Text>
          <View
            style={{
              width: 36,
              height: 2,
              backgroundColor: garland.green,
              marginVertical: 24,
            }}
          />
          <Text
            style={{
              fontSize: 16,
              lineHeight: 25,
              color: garland.ink60,
              maxWidth: 280,
            }}
          >
            A quiet place to share gift ideas with people you love.
          </Text>
        </View>

        <View className="pb-9" style={{ gap: 12 }}>
          <Pressable
            onPress={() => router.push('/signin')}
            style={{
              backgroundColor: garland.ink,
              borderRadius: 999,
              paddingVertical: 15,
              paddingHorizontal: 18,
            }}
          >
            <Text
              style={{ color: garland.paper, fontSize: 16, fontWeight: '600' }}
              className="text-center"
            >
              Get started
            </Text>
          </Pressable>
          <Text
            className="text-center"
            style={{ fontSize: 12, color: garland.ink40, lineHeight: 18 }}
          >
            Sign in or create an account — same place, no password.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  )
}
