import { router } from 'expo-router'
import { useFormik } from 'formik'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LocalSvg } from 'react-native-svg/css'
import * as Yup from 'yup'

import backArrowAsset from '@/assets/svg/back-arrow.svg'
import { Text } from '@/components/ui/text'
import { garland } from '@/constants/garland'
import { useAuth } from '@/hooks/useAuth'
import { AuthField } from '@/ui/components/AuthField'

const validationSchema = Yup.object({
  email: Yup.string().email('Invalid email').required('Required'),
})

export function SignInScreen() {
  const { requestMagicLink } = useAuth()

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
              err.reason ?? err.error?.toString() ?? 'Something went wrong',
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
              Welcome
            </Text>
            <Text className="mt-2 font-garland-display text-[38px] leading-[39px] text-garland-ink">
              Sign in.
            </Text>
            <Text className="mt-2.5 text-sm leading-[21px] text-garland-ink-60">
              {`Enter your email and we'll send a magic link. New here? We'll set you up right after.`}
            </Text>
          </View>

          <View className="mt-6">
            <AuthField
              label="Email"
              placeholder="you@example.com"
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
            <Pressable
              onPress={() => handleSubmit()}
              disabled={isSubmitting}
              className={`rounded-full bg-garland-ink px-[18px] py-[15px] ${
                isSubmitting ? 'opacity-60' : 'opacity-100'
              }`}
            >
              {isSubmitting ? (
                <ActivityIndicator color={garland.paper} />
              ) : (
                <Text className="text-center text-base font-semibold text-garland-paper">
                  Email me a link
                </Text>
              )}
            </Pressable>

            <View className="my-5 flex-row items-center gap-2.5">
              <View className="h-px flex-1 bg-garland-ink-08" />
              <Text className="text-xs font-bold uppercase tracking-[1.1px] text-garland-ink-40">
                or
              </Text>
              <View className="h-px flex-1 bg-garland-ink-08" />
            </View>

            <Pressable
              onPress={() => {
                // Google sign-in is not wired up yet. Once it lands, route to
                // /check-email or directly to the post-auth flow.
              }}
              className="flex-row items-center justify-center gap-2.5 rounded-full border-[1.5px] border-garland-ink-15 px-[18px] py-[13px]"
            >
              <Text className="text-base font-bold text-garland-ink">G</Text>
              <Text className="text-sm font-semibold text-garland-ink">
                Continue with Google
              </Text>
            </Pressable>

            <Text className="mt-4 text-center text-xs leading-[18px] text-garland-ink-40">
              By continuing you agree to the{' '}
              <Text className="font-bold text-garland-ink">Terms</Text> and{' '}
              <Text className="font-bold text-garland-ink">Privacy Policy</Text>
              .
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
