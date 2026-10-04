import { useFormik } from 'formik'
import { useRef, useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { KeyboardAvoidingView, Platform, Pressable, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as Yup from 'yup'

import { uploadImage } from '@/api/images'
import { updateUser } from '@/api/users'
import { Text } from '@/components/ui/text'
import { type AvatarKey, avatar } from '@/constants/avatars'
import { usePhotoPrompt } from '@/hooks/usePhotoPrompt'
import { errorMessage } from '@/localization/errorMessage'
import { AuthField } from '@/ui/components/AuthField'
import { Avatar } from '@/ui/components/Avatar'
import {
  AvatarPickerModal,
  type AvatarPickerModalHandle,
} from '@/ui/components/AvatarPickerModal'
import { GarlandButton, GarlandButtonText } from '@/ui/components/GarlandButton'
import { LanguageChangeButton } from '@/ui/components/LanguageChangeButton'
import { PhotoUploadTile } from '@/ui/components/PhotoUploadTile'

export function FirstLoginScreen() {
  const [selected, setSelected] = useState<AvatarKey>('f1')
  // A photo's local uri: it previews here and uploads on Continue.
  const [localPhoto, setLocalPhoto] = useState<string>()
  const avatarPickerRef = useRef<AvatarPickerModalHandle>(null)
  const photoPrompt = usePhotoPrompt(setLocalPhoto, { square: true })
  const { t } = useTranslation()

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
    // Once the name is saved, the user document carries it and the root
    // guards open the app; there's no skipping it.
    // The stock avatar is saved with a photo too, as its fallback
    // (docs/spec.md §1.10).
    onSubmit: async (formValues, { setSubmitting, setFieldError }) => {
      try {
        const photo = localPhoto
          ? (await uploadImage(localPhoto)).id
          : undefined
        await updateUser({
          name: formValues.name.trim(),
          avatar: selected,
          ...(photo ? { photo } : {}),
        })
      } catch (err) {
        setFieldError('name', errorMessage(err, t('common.somethingWentWrong')))
      } finally {
        setSubmitting(false)
      }
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
            <LanguageChangeButton />
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
                accessibilityRole="button"
                accessibilityLabel={t('avatarPicker.title')}
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              >
                <Avatar
                  source={localPhoto ? { uri: localPhoto } : avatar(selected)}
                  size={72}
                />
              </Pressable>
              <PhotoUploadTile onPress={photoPrompt.prompt} size={72} />
              <Text className="flex-1 text-xs leading-[18px] text-garland-ink-40">
                <Trans
                  i18nKey="firstLogin.uploadHint"
                  components={[
                    <Text key="plus" className="font-bold text-garland-ink" />,
                  ]}
                />
              </Text>
            </View>
            {photoPrompt.error ? (
              <Text className="mt-2 text-xs text-garland-berry">
                {t(`photoPicker.errors.${photoPrompt.error}`)}
              </Text>
            ) : null}
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
        // Picking one of ours drops the photo.
        onConfirm={key => {
          setSelected(key)
          setLocalPhoto(undefined)
        }}
      />
    </SafeAreaView>
  )
}
