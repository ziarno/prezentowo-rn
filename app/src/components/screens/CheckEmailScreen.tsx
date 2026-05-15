import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import { Linking, Platform, Pressable, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Svg, { Path } from 'react-native-svg'

import { Text } from '@/components/ui/text'
import { displayFont, garland } from '@/constants/garland'
import { useAuth } from '@/hooks/useAuth'
import { useAuthStore } from '@/store/useAuthStore'

function BackArrow() {
  return (
    <Svg
      width={22}
      height={22}
      viewBox="0 0 24 24"
      fill="none"
      stroke={garland.ink}
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M19 12H5M12 19l-7-7 7-7" />
    </Svg>
  )
}

function SendIcon() {
  return (
    <Svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke={garland.green}
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M22 2 11 13" />
      <Path d="M22 2 15 22l-4-9-9-4 20-7z" />
    </Svg>
  )
}

const RESEND_SECONDS = 42

function formatCountdown(s: number) {
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${r.toString().padStart(2, '0')}`
}

export function CheckEmailScreen() {
  const email = useAuthStore(s => s.pendingEmail) ?? 'your inbox'
  const { requestMagicLink } = useAuth()
  const [countdown, setCountdown] = useState(RESEND_SECONDS)

  useEffect(() => {
    if (countdown <= 0) return
    const id = setInterval(() => setCountdown(c => Math.max(0, c - 1)), 1000)
    return () => clearInterval(id)
  }, [countdown])

  const openMail = () => {
    const url = Platform.OS === 'ios' ? 'message://' : 'mailto:'
    Linking.openURL(url).catch(() => {})
  }

  const resend = () => {
    if (countdown > 0 || email === 'your inbox') return
    setCountdown(RESEND_SECONDS)
    requestMagicLink({
      email,
      onSuccess: () => {},
      onError: () => {},
    })
  }

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: garland.paper }}>
      <View className="flex-1 px-7">
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          className="py-3.5"
        >
          <BackArrow />
        </Pressable>

        <View className="pt-4">
          <Text
            className="font-bold uppercase"
            style={{ fontSize: 11, color: garland.ink40, letterSpacing: 1.1 }}
          >
            Check your email
          </Text>
          <Text
            className="mt-2"
            style={{
              fontFamily: displayFont,
              fontSize: 36,
              lineHeight: 37,
              color: garland.ink,
            }}
          >
            We sent you{'\n'}a magic link.
          </Text>
          <Text
            className="mt-3.5"
            style={{ fontSize: 14, lineHeight: 21, color: garland.ink60 }}
          >
            Tap the link in the email we just sent to{' '}
            <Text style={{ color: garland.ink, fontWeight: '700' }}>
              {email}
            </Text>{' '}
            to finish signing in. The link works for 15 minutes.
          </Text>
        </View>

        <View
          className="mt-7 flex-row items-start"
          style={{
            padding: 18,
            borderRadius: 16,
            backgroundColor: garland.paper2,
            gap: 14,
          }}
        >
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              backgroundColor: 'rgba(29,26,20,0.04)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <SendIcon />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              style={{ fontSize: 14, fontWeight: '700', color: garland.ink }}
            >
              Sent just now
            </Text>
            <Text
              className="mt-1"
              style={{ fontSize: 12, color: garland.ink60, lineHeight: 18 }}
            >
              {`From hello@prezentowo.app · check spam if you don't see it.`}
            </Text>
          </View>
        </View>

        <View className="flex-1" />

        <View className="pb-9">
          <Pressable
            onPress={openMail}
            style={{
              backgroundColor: garland.ink,
              borderRadius: 999,
              paddingVertical: 15,
              paddingHorizontal: 18,
            }}
          >
            <Text
              className="text-center"
              style={{ color: garland.paper, fontSize: 16, fontWeight: '600' }}
            >
              Open mail app
            </Text>
          </Pressable>
          <Pressable onPress={resend} className="mt-4">
            <Text
              className="text-center"
              style={{ fontSize: 13, color: garland.ink60 }}
            >
              {`Didn't get it? `}
              <Text style={{ color: garland.ink, fontWeight: '700' }}>
                {countdown > 0
                  ? `Resend in ${formatCountdown(countdown)}`
                  : 'Resend'}
              </Text>
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  )
}
