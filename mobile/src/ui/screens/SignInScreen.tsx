import { Trans, useLingui } from '@lingui/react/macro'
import { router } from 'expo-router'
import { useFormik } from 'formik'
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LocalSvg } from 'react-native-svg/css'
import * as Yup from 'yup'

import backArrowAsset from '@/assets/svg/back-arrow.svg'
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { garland } from '@/constants/garland'
import { useAuth } from '@/hooks/useAuth'
import { AuthField } from '@/ui/components/AuthField'

export function SignInScreen() {
  const { requestMagicLink } = useAuth()
  const { t } = useLingui()

  const validationSchema = Yup.object({
    email: Yup.string()
      .email(t`Invalid email`)
      .required(t`Required`),
  })

  const {
    values,
    errors,
    touched,
    handleChange,
    handleBlur,
    handleSubmit,
    isSubmitting,
    setErrors,
  } = useFormik({
    initialValues: { email: '' },
    validationSchema,
    onSubmit: ({ email }, { setSubmitting }) => {
      requestMagicLink({
        email,
        onSuccess: () => {
          setSubmitting(false)
          router.push('/check-email')
        },
        onError: err => {
          setSubmitting(false)
          setErrors({
            email:
              err.reason ?? err.error?.toString() ?? t`Something went wrong`,
          })
        },
      })
    },
  })

  return (
    <SafeAreaView className="flex-1 bg-garland-paper">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
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
              <Trans>Welcome</Trans>
            </Text>
            <Text className="mt-2 font-garland-display text-[38px] leading-[39px] text-garland-ink">
              <Trans>Sign in.</Trans>
            </Text>
            <Text className="mt-2.5 text-sm leading-[21px] text-garland-ink-60">
              <Trans>
                Enter your email and we&apos;ll send a magic link. New here?
                We&apos;ll set you up right after.
              </Trans>
            </Text>
          </View>

          <View className="mt-6">
            <AuthField
              label={t`Email`}
              placeholder={t`you@example.com`}
              value={values.email}
              onChangeText={handleChange('email')}
              onBlur={handleBlur('email')}
              autoCapitalize="none"
              keyboardType="email-address"
              textContentType="emailAddress"
              autoComplete="email"
              autoCorrect={false}
              errorMessage={
                touched.email && errors.email ? errors.email : undefined
              }
            />
          </View>

          <View className="flex-1" />

          <View className="pb-9">
            <Button
              onPress={() => handleSubmit()}
              disabled={isSubmitting}
              className="h-auto rounded-full bg-garland-ink px-[18px] py-[15px]"
            >
              {isSubmitting ? (
                <ButtonSpinner color={garland.paper} />
              ) : (
                <ButtonText className="text-base font-semibold text-garland-paper">
                  <Trans>Email me a link</Trans>
                </ButtonText>
              )}
            </Button>

            <View className="my-5 flex-row items-center gap-2.5">
              <View className="h-px flex-1 bg-garland-ink-08" />
              <Text className="text-xs font-bold uppercase tracking-[1.1px] text-garland-ink-40">
                <Trans>or</Trans>
              </Text>
              <View className="h-px flex-1 bg-garland-ink-08" />
            </View>

            <Button
              onPress={() => {
                // Google sign-in is not wired up yet.
              }}
              className="h-auto rounded-full border-[1.5px] border-garland-ink-15 bg-transparent px-[18px] py-[13px] gap-2.5"
            >
              <ButtonText className="text-base font-bold text-garland-ink">
                G
              </ButtonText>
              <ButtonText className="text-sm font-semibold text-garland-ink">
                <Trans>Continue with Google</Trans>
              </ButtonText>
            </Button>

            <Text className="mt-4 text-center text-xs leading-[18px] text-garland-ink-40">
              <Trans>
                By continuing you agree to the{' '}
                <Text className="font-bold text-garland-ink">Terms</Text> and{' '}
                <Text className="font-bold text-garland-ink">
                  Privacy Policy
                </Text>
                .
              </Trans>
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
