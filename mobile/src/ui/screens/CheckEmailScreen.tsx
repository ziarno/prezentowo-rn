import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import { Linking, Platform, Pressable, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LocalSvg } from 'react-native-svg/css'

import backArrowAsset from '@/assets/svg/back-arrow.svg'
import sendIconAsset from '@/assets/svg/send-icon.svg'
import { Text } from '@/components/ui/text'
import { useAuth } from '@/hooks/useAuth'
import { useAuthStore } from '@/store/useAuthStore'

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
    <SafeAreaView className="flex-1 bg-garland-paper">
      <View className="flex-1 px-7">
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          className="py-3.5"
        >
          <LocalSvg asset={backArrowAsset} width={22} height={22} />
        </Pressable>

        <View className="pt-4">
          <Text className="text-[11px] font-bold uppercase tracking-[1.1px] text-garland-ink-40">
            Check your email
          </Text>
          <Text className="mt-2 font-garland-display text-[36px] leading-[37px] text-garland-ink">
            We sent you{'\n'}a magic link.
          </Text>
          <Text className="mt-3.5 text-sm leading-[21px] text-garland-ink-60">
            Tap the link in the email we just sent to{' '}
            <Text className="font-bold text-garland-ink">{email}</Text> to
            finish signing in. The link works for 15 minutes.
          </Text>
        </View>

        <View className="mt-7 flex-row items-start gap-3.5 rounded-2xl bg-garland-paper2 p-[18px]">
          <View className="h-10 w-10 items-center justify-center rounded-xl bg-[rgba(29,26,20,0.04)]">
            <LocalSvg asset={sendIconAsset} width={18} height={18} />
          </View>
          <View className="min-w-0 flex-1">
            <Text className="text-sm font-bold text-garland-ink">
              Sent just now
            </Text>
            <Text className="mt-1 text-xs leading-[18px] text-garland-ink-60">
              {`From hello@prezentowo.app · check spam if you don't see it.`}
            </Text>
          </View>
        </View>

        <View className="flex-1" />

        <View className="pb-9">
          <Pressable
            onPress={openMail}
            className="rounded-full bg-garland-ink px-[18px] py-[15px]"
          >
            <Text className="text-center text-base font-semibold text-garland-paper">
              Open mail app
            </Text>
          </Pressable>
          <Pressable onPress={resend} className="mt-4">
            <Text className="text-center text-[13px] text-garland-ink-60">
              {`Didn't get it? `}
              <Text className="font-bold text-garland-ink">
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
