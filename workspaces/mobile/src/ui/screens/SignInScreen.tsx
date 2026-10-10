import { router } from 'expo-router'
import { useFormik } from 'formik'
import { Trans, useTranslation } from 'react-i18next'
import { KeyboardAvoidingView, Platform, Pressable, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LocalSvg } from 'react-native-svg/css'
import * as Yup from 'yup'

import backArrowAsset from '@/assets/svg/back-arrow.svg'
import { Text } from '@/components/ui/text'
import { useAuth } from '@/hooks/useAuth'
import { useOpenLegalPage } from '@/hooks/useOpenLegalPage'
import { errorMessage } from '@/localization/errorMessage'
import { AuthField } from '@/ui/components/AuthField'
import { GarlandButton, GarlandButtonText } from '@/ui/components/GarlandButton'
import { LanguageChangeButton } from '@/ui/components/LanguageChangeButton'

export function SignInScreen() {
  const { requestMagicLink } = useAuth()
  const { t } = useTranslation()
  const openLegalPage = useOpenLegalPage()

  const validationSchema = Yup.object({
    email: Yup.string()
      .email(t('signin.invalidEmail'))
      .required(t('common.required')),
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
            email: errorMessage(err, t('common.somethingWentWrong')),
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
          <View className="flex-row items-center justify-between py-3.5">
            <Pressable onPress={() => router.back()} hitSlop={12}>
              <LocalSvg asset={backArrowAsset} width={22} height={22} />
            </Pressable>
            <LanguageChangeButton />
          </View>

          <View className="pt-4">
            <Text className="text-[11px] font-bold uppercase tracking-[1.1px] text-garland-ink-40">
              {t('signin.eyebrow')}
            </Text>
            <Text className="mt-2 font-garland-display text-[38px] leading-[39px] text-garland-ink">
              {t('signin.title')}
            </Text>
            <Text className="mt-2.5 text-sm leading-[21px] text-garland-ink-60">
              {t('signin.subtitle')}
            </Text>
          </View>

          <View className="mt-6">
            <AuthField
              label={t('signin.emailLabel')}
              placeholder={t('signin.emailPlaceholder')}
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
            <GarlandButton
              loading={isSubmitting}
              onPress={() => handleSubmit()}
              disabled={isSubmitting}
            >
              <GarlandButtonText>{t('signin.emailMeLink')}</GarlandButtonText>
            </GarlandButton>

            <View className="my-5 flex-row items-center gap-2.5">
              <View className="h-px flex-1 bg-garland-ink-08" />
              <Text className="text-xs font-bold uppercase tracking-[1.1px] text-garland-ink-40">
                {t('signin.or')}
              </Text>
              <View className="h-px flex-1 bg-garland-ink-08" />
            </View>

            <GarlandButton
              variant="outline"
              onPress={() => {
                // Google sign-in is not wired up yet.
              }}
            >
              <GarlandButtonText className="font-bold">G</GarlandButtonText>
              <GarlandButtonText className="text-sm">
                {t('signin.continueWithGoogle')}
              </GarlandButtonText>
            </GarlandButton>

            <Text className="mt-4 text-center text-xs leading-[18px] text-garland-ink-40">
              <Trans
                i18nKey="signin.terms"
                components={[
                  <Text
                    key="terms"
                    onPress={() => openLegalPage('terms')}
                    accessibilityRole="link"
                    className="text-xs font-bold text-garland-ink"
                  />,
                  <Text
                    key="privacy"
                    onPress={() => openLegalPage('privacy')}
                    accessibilityRole="link"
                    className="text-xs font-bold text-garland-ink"
                  />,
                ]}
              />
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
