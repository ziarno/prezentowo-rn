import { useFormik } from 'formik'
import { useRef, useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { KeyboardAvoidingView, Platform, Pressable, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LocalSvg } from 'react-native-svg/css'
import * as Yup from 'yup'

import plusIconAsset from '@/assets/svg/plus-icon.svg'
import { Text } from '@/components/ui/text'
import { type AvatarKey, avatar } from '@/constants/avatars'
import { useAuthStore } from '@/store/useAuthStore'
import { AuthField } from '@/ui/components/AuthField'
import { Avatar } from '@/ui/components/Avatar'
import {
  AvatarPickerModal,
  type AvatarPickerModalHandle,
} from '@/ui/components/AvatarPickerModal'
import { GarlandButton, GarlandButtonText } from '@/ui/components/GarlandButton'
import { LanguageChangeButton } from '@/ui/components/LanguageChangeButton'

export function FirstLoginScreen() {
  const [selected, setSelected] = useState<AvatarKey>('f1')
  const avatarPickerRef = useRef<AvatarPickerModalHandle>(null)
  const { t } = useTranslation()
  const setFirstLoginPending = useAuthStore(s => s.setFirstLoginPending)

  const validationSchema = Yup.object({
    name: Yup.string().trim().required(t('common.required')),
  })

  const {
    values,
    errors,
    touched,
    handleChange,
    handleBlur,
    handleSubmit,
    isSubmitting,
  } = useFormik({
    initialValues: { name: '' },
    validationSchema,
    onSubmit: (_, { setSubmitting }) => {
      // TODO: persist {name, avatar} via Meteor.call('updateUser', …) once
      // the magic-link sign-in path is in place. For now we just hand the
      // user off to the app shell.
      setFirstLoginPending(false)
      setSubmitting(false)
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
            <Text className="text-xs font-bold uppercase tracking-[1px] text-garland-ink-40">
              {t('firstLogin.step')}
            </Text>
            <View className="flex-row items-center gap-3">
              <LanguageChangeButton />
              <GarlandButton
                variant="link"
                hitSlop={12}
                onPress={() => setFirstLoginPending(false)}
              >
                <GarlandButtonText>{t('common.skip')}</GarlandButtonText>
              </GarlandButton>
            </View>
          </View>

          <View className="pt-1.5">
            <Text className="text-[11px] font-bold uppercase tracking-[1.1px] text-garland-ink-40">
              {t('firstLogin.eyebrow')}
            </Text>
            <Text className="mt-2 font-garland-display text-[34px] leading-[35px] text-garland-ink">
              {t('firstLogin.titleLine1')}
              {'\n'}
              {t('firstLogin.titleLine2')}
            </Text>
            <Text className="mt-2.5 text-sm leading-[21px] text-garland-ink-60">
              {t('firstLogin.subtitle')}
            </Text>
          </View>

          <View className="mt-6">
            <AuthField
              label={t('firstLogin.nameLabel')}
              placeholder={t('firstLogin.namePlaceholder')}
              value={values.name}
              onChangeText={handleChange('name')}
              onBlur={handleBlur('name')}
              autoCapitalize="words"
              textContentType="name"
              errorMessage={
                touched.name && errors.name ? errors.name : undefined
              }
            />
          </View>

          <View className="mt-6">
            <Text className="mb-3 text-[11px] font-bold uppercase tracking-[1.1px] text-garland-ink-40">
              {t('firstLogin.profilePicture')}
            </Text>
            <View className="flex-row items-center gap-3.5">
              <Pressable
                onPress={() => avatarPickerRef.current?.present()}
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              >
                <Avatar source={avatar(selected)} size={72} />
              </Pressable>
              <UploadTile />
              <Text className="flex-1 text-xs leading-[18px] text-garland-ink-40">
                <Trans
                  i18nKey="firstLogin.uploadHint"
                  components={[
                    <Text key="plus" className="font-bold text-garland-ink" />,
                  ]}
                />
              </Text>
            </View>
          </View>

          <View className="flex-1" />

          <View className="pb-9">
            <GarlandButton
              loading={isSubmitting}
              onPress={() => handleSubmit()}
              disabled={isSubmitting}
            >
              <GarlandButtonText>{t('common.continue')}</GarlandButtonText>
            </GarlandButton>
          </View>
        </View>
      </KeyboardAvoidingView>

      <AvatarPickerModal
        ref={avatarPickerRef}
        value={selected}
        onConfirm={setSelected}
      />
    </SafeAreaView>
  )
}

function UploadTile() {
  return (
    <Pressable
      className="size-[72px] items-center justify-center rounded-full border-[1.5px] border-dashed border-[rgba(0,0,0,0.2)] bg-[rgba(0,0,0,0.02)]"
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
    >
      <LocalSvg asset={plusIconAsset} width={20} height={20} />
    </Pressable>
  )
}
