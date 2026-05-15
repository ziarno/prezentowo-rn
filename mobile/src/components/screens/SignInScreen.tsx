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
import Svg, { Path } from 'react-native-svg'
import * as Yup from 'yup'

import { AuthField } from '@/components/garland/AuthField'
import { Text } from '@/components/ui/text'
import { displayFont, garland } from '@/constants/garland'
import { useAuth } from '@/hooks/useAuth'

const validationSchema = Yup.object({
  email: Yup.string().email('Invalid email').required('Required'),
})

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
    <SafeAreaView className="flex-1" style={{ backgroundColor: garland.paper }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
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
              Welcome
            </Text>
            <Text
              className="mt-2"
              style={{
                fontFamily: displayFont,
                fontSize: 38,
                lineHeight: 39,
                color: garland.ink,
              }}
            >
              Sign in.
            </Text>
            <Text
              className="mt-2.5"
              style={{ fontSize: 14, lineHeight: 21, color: garland.ink60 }}
            >
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
              style={{
                backgroundColor: garland.ink,
                borderRadius: 999,
                paddingVertical: 15,
                paddingHorizontal: 18,
                opacity: isSubmitting ? 0.6 : 1,
              }}
            >
              {isSubmitting ? (
                <ActivityIndicator color={garland.paper} />
              ) : (
                <Text
                  style={{
                    color: garland.paper,
                    fontSize: 16,
                    fontWeight: '600',
                  }}
                  className="text-center"
                >
                  Email me a link
                </Text>
              )}
            </Pressable>

            <View className="my-5 flex-row items-center" style={{ gap: 10 }}>
              <View
                className="h-px flex-1"
                style={{ backgroundColor: garland.ink08 }}
              />
              <Text
                className="font-bold uppercase"
                style={{
                  fontSize: 12,
                  color: garland.ink40,
                  letterSpacing: 1.1,
                }}
              >
                or
              </Text>
              <View
                className="h-px flex-1"
                style={{ backgroundColor: garland.ink08 }}
              />
            </View>

            <Pressable
              onPress={() => {
                // Google sign-in is not wired up yet. Once it lands, route to
                // /check-email or directly to the post-auth flow.
              }}
              style={{
                borderRadius: 999,
                paddingVertical: 13,
                paddingHorizontal: 18,
                borderWidth: 1.5,
                borderColor: garland.ink15,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
              }}
            >
              <Text
                style={{ fontSize: 16, color: garland.ink, fontWeight: '700' }}
              >
                G
              </Text>
              <Text
                style={{ fontSize: 14, color: garland.ink, fontWeight: '600' }}
              >
                Continue with Google
              </Text>
            </Pressable>

            <Text
              className="mt-4 text-center"
              style={{ fontSize: 12, color: garland.ink40, lineHeight: 18 }}
            >
              By continuing you agree to the{' '}
              <Text style={{ color: garland.ink, fontWeight: '700' }}>
                Terms
              </Text>{' '}
              and{' '}
              <Text style={{ color: garland.ink, fontWeight: '700' }}>
                Privacy Policy
              </Text>
              .
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
