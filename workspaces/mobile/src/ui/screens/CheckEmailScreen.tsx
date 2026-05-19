import { Trans, useLingui } from '@lingui/react/macro'
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
import { AuthField } from '@/ui/components/AuthField'
import { GarlandButton, GarlandButtonText } from '@/ui/components/GarlandButton'
import { LanguageChangeButton } from '@/ui/components/LanguageChangeButton'

const RESEND_SECONDS = 42

function formatCountdown(s: number) {
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${r.toString().padStart(2, '0')}`
}

export function CheckEmailScreen() {
  const pendingEmail = useAuthStore(s => s.pendingEmail)
  const { requestMagicLink, loginWithMagicToken, isLoading } = useAuth()
  const { t } = useLingui()
  const email = pendingEmail ?? t`your inbox`
  const [countdown, setCountdown] = useState(RESEND_SECONDS)
  const [code, setCode] = useState('')
  const [codeError, setCodeError] = useState<string | undefined>()

  useEffect(() => {
    if (countdown <= 0) return
    const id = setInterval(() => setCountdown(c => Math.max(0, c - 1)), 1000)
    return () => clearInterval(id)
  }, [countdown])

  const openMail = () => {
    const url = Platform.OS === 'ios' ? 'message://' : 'mailto:'
    Linking.openURL(url).catch(() => {})
  }

  const submitCode = () => {
    if (!pendingEmail) {
      setCodeError(t`Restart sign-in and try again.`)
      return
    }
    if (code.trim().length < 4) {
      setCodeError(t`Enter the code from your email.`)
      return
    }
    setCodeError(undefined)
    loginWithMagicToken({
      email: pendingEmail,
      token: code,
      onSuccess: () => setCode(''),
      onError: err =>
        setCodeError(
          err.reason ?? err.error?.toString() ?? t`That code didn't work.`,
        ),
    })
  }

  const resend = () => {
    if (countdown > 0 || !pendingEmail) return
    setCountdown(RESEND_SECONDS)
    requestMagicLink({
      email: pendingEmail,
      onSuccess: () => {},
      onError: () => {},
    })
  }

  return (
    <SafeAreaView className="flex-1 bg-garland-paper">
      <View className="flex-1 px-7">
        <View className="flex-row items-center justify-between py-3.5">
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <LocalSvg asset={backArrowAsset} width={22} height={22} />
          </Pressable>
          <LanguageChangeButton />
        </View>

        <View className="pt-4">
          <Text className="text-[11px] font-bold uppercase tracking-[1.1px] text-garland-ink-40">
            <Trans>Check your email</Trans>
          </Text>
          <Text className="mt-2 font-garland-display text-[36px] leading-[37px] text-garland-ink">
            <Trans>We sent you</Trans>
            {'\n'}
            <Trans>a magic link.</Trans>
          </Text>
          <Text className="mt-3.5 text-sm leading-[21px] text-garland-ink-60">
            <Trans>
              Tap the link in the email we just sent to{' '}
              <Text className="font-bold text-garland-ink">{email}</Text> to
              finish signing in. The link works for 15 minutes.
            </Trans>
          </Text>
        </View>

        <View className="mt-7 flex-row items-start gap-3.5 rounded-2xl bg-garland-paper2 p-[18px]">
          <View className="h-10 w-10 items-center justify-center rounded-xl bg-[rgba(29,26,20,0.04)]">
            <LocalSvg asset={sendIconAsset} width={18} height={18} />
          </View>
          <View className="min-w-0 flex-1">
            <Text className="text-sm font-bold text-garland-ink">
              <Trans>Sent just now</Trans>
            </Text>
            <Text className="mt-1 text-xs leading-[18px] text-garland-ink-60">
              <Trans>
                From hello@prezentowo.app · check spam if you don&apos;t see it.
              </Trans>
            </Text>
          </View>
        </View>

        <View className="mt-6">
          <AuthField
            label={t`Or paste your 6-digit code`}
            placeholder="A1B2C3"
            value={code}
            onChangeText={setCode}
            autoCapitalize="characters"
            autoCorrect={false}
            keyboardType="default"
            maxLength={12}
            errorMessage={codeError}
          />
          <GarlandButton
            className="mt-4"
            loading={isLoading}
            disabled={isLoading}
            onPress={submitCode}
          >
            <GarlandButtonText>
              <Trans>Finish signing in</Trans>
            </GarlandButtonText>
          </GarlandButton>
        </View>

        <View className="flex-1" />

        <View className="pb-9">
          <GarlandButton variant="outline" onPress={openMail}>
            <GarlandButtonText>
              <Trans>Open mail app</Trans>
            </GarlandButtonText>
          </GarlandButton>

          <GarlandButton variant="link" onPress={resend} className="mt-4">
            <Text className="text-center text-[13px] text-garland-ink-60">
              <Trans>Didn&apos;t get it?</Trans>{' '}
              <Text className="font-bold text-garland-ink">
                {countdown > 0
                  ? t`Resend in ${formatCountdown(countdown)}`
                  : t`Resend`}
              </Text>
            </Text>
          </GarlandButton>
        </View>
      </View>
    </SafeAreaView>
  )
}
