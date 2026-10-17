import {
  birthDateProblem,
  earliestBirthDate,
  todayUtc,
} from '@prezentowo/types'
import { useFormik } from 'formik'
import { useRef, useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { KeyboardAvoidingView, Platform, Pressable, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as Yup from 'yup'

import { answerBirthDate } from '@/api/birthDate'
import { uploadImage } from '@/api/images'
import { setBirthDate, updateUser } from '@/api/users'
import { Text } from '@/components/ui/text'
import { type AvatarKey, avatar } from '@/constants/avatars'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { usePhotoPrompt } from '@/hooks/usePhotoPrompt'
import { errorMessage } from '@/localization/errorMessage'
import { useAuthStore } from '@/store/useAuthStore'
import { AuthField } from '@/ui/components/AuthField'
import { Avatar } from '@/ui/components/Avatar'
import {
  AvatarPickerModal,
  type AvatarPickerModalHandle,
} from '@/ui/components/AvatarPickerModal'
import { DateField } from '@/ui/components/DateField'
import { GarlandButton, GarlandButtonText } from '@/ui/components/GarlandButton'
import { LanguageChangeButton } from '@/ui/components/LanguageChangeButton'
import { PhotoUploadTile } from '@/ui/components/PhotoUploadTile'

// The heading: the name-and-photo copy for a new account, the age-only copy
// for an account from before the age question, which already has a name.
const HEADINGS = {
  nameAndPhoto: {
    eyebrow: 'firstLogin.eyebrow',
    titleLine1: 'firstLogin.titleLine1',
    titleLine2: 'firstLogin.titleLine2',
    subtitle: 'firstLogin.subtitle',
  },
  ageOnly: {
    eyebrow: 'firstLogin.ageEyebrow',
    titleLine1: 'firstLogin.ageTitleLine1',
    titleLine2: 'firstLogin.ageTitleLine2',
    subtitle: 'firstLogin.ageSubtitle',
  },
} as const

export function FirstLoginScreen() {
  const [selected, setSelected] = useState<AvatarKey>('f1')
  // A photo's local uri: it previews here and uploads on Continue.
  const [localPhoto, setLocalPhoto] = useState<string>()
  const avatarPickerRef = useRef<AvatarPickerModalHandle>(null)
  const photoPrompt = usePhotoPrompt(setLocalPhoto, { square: true })
  const { t } = useTranslation()
  const setUnderAge = useAuthStore(s => s.setUnderAge)
  // What this person still has to give: a new account has neither, an account
  // from before the age question has a name and is asked the age once
  // (docs/spec.md §1.15). The name is fixed when the screen opens, so saving
  // it can't make the screen drop it mid-submit; the age follows the user
  // document, so a date that is already stored (an earlier try got that far)
  // is never asked for again.
  const user = useCurrentUser()
  const [needsName] = useState(() => !user?.profile?.name?.trim())
  const needsAge = !user?.birthDate
  const heading = HEADINGS[needsName ? 'nameAndPhoto' : 'ageOnly']

  const validationSchema = Yup.object({
    name: needsName
      ? Yup.string().trim().required(t('common.required'))
      : Yup.string(),
    // No default: nothing is picked until they pick it. Judged against the
    // day it is submitted, with the server's own rules.
    birthDate: needsAge
      ? Yup.string()
          .required(t('firstLogin.birthDateRequired'))
          .test('real-date', (value, context) => {
            const problem = birthDateProblem(value, todayUtc())
            return problem
              ? context.createError({
                  message: t(`firstLogin.birthDateProblem.${problem}`),
                })
              : true
          })
      : Yup.string(),
  })

  const {
    values,
    errors,
    touched,
    handleChange,
    handleBlur,
    handleSubmit,
    isSubmitting,
    setFieldValue,
    setFieldTouched,
  } = useFormik({
    initialValues: { name: '', birthDate: '' },
    validationSchema,
    // Once the name is saved, the user document carries it and the root
    // guards open the app; there's no skipping it.
    // The stock avatar is saved with a photo too, as its fallback
    // (docs/spec.md §1.10).
    onSubmit: async (formValues, { setSubmitting, setFieldError }) => {
      let failedField: 'name' | 'birthDate' = 'birthDate'
      try {
        if (needsAge) {
          // Under 13, nothing is saved: not even the name typed above. The
          // server deletes the account, and the stop message takes over
          // before the document going away can move the guards.
          const outcome = await answerBirthDate(
            formValues.birthDate,
            todayUtc(),
            setBirthDate,
            setUnderAge,
          )
          if (outcome === 'stopped') return
        }
        if (!needsName) return
        failedField = 'name'
        const photo = localPhoto
          ? (await uploadImage(localPhoto)).id
          : undefined
        await updateUser({
          name: formValues.name.trim(),
          avatar: selected,
          ...(photo ? { photo } : {}),
        })
      } catch (err) {
        setFieldError(
          failedField,
          errorMessage(err, t('common.somethingWentWrong')),
        )
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
              {t(heading.eyebrow)}
            </Text>
            <Text className="mt-2 font-garland-display text-[34px] leading-[35px] text-garland-ink">
              {t(heading.titleLine1)}
              {'\n'}
              {t(heading.titleLine2)}
            </Text>
            <Text className="mt-2.5 text-sm leading-[21px] text-garland-ink-60">
              {t(heading.subtitle)}
            </Text>
          </View>

          {needsName ? (
            <>
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
              <ProfilePictureField
                avatarKey={selected}
                localPhoto={localPhoto}
                onAvatarPress={() => avatarPickerRef.current?.present()}
                onPhotoPress={photoPrompt.prompt}
                error={photoPrompt.error}
              />
            </>
          ) : null}

          {needsAge ? (
            <BirthDateField
              value={values.birthDate}
              error={touched.birthDate ? errors.birthDate : undefined}
              onChange={value => {
                void setFieldValue('birthDate', value)
                void setFieldTouched('birthDate', true, false)
              }}
            />
          ) : null}

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

// The picture row: the stock avatar (tap to choose another), the upload tile
// and a hint, with the photo picker's error under it.
function ProfilePictureField({
  avatarKey,
  localPhoto,
  onAvatarPress,
  onPhotoPress,
  error,
}: {
  avatarKey: AvatarKey
  localPhoto: string | undefined
  onAvatarPress: () => void
  onPhotoPress: () => void
  error: string | undefined | null
}) {
  const { t } = useTranslation()
  return (
    <View className="mt-6">
      <Text className="mb-3 text-[11px] font-bold uppercase tracking-[1.1px] text-garland-ink-40">
        {t('firstLogin.profilePicture')}
      </Text>
      <View className="flex-row items-center gap-3.5">
        <Pressable
          onPress={onAvatarPress}
          accessibilityRole="button"
          accessibilityLabel={t('avatarPicker.title')}
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
        >
          <Avatar
            source={localPhoto ? { uri: localPhoto } : avatar(avatarKey)}
            size={72}
          />
        </Pressable>
        <PhotoUploadTile onPress={onPhotoPress} size={72} />
        <Text className="flex-1 text-xs leading-[18px] text-garland-ink-40">
          <Trans
            i18nKey="firstLogin.uploadHint"
            components={[
              <Text key="plus" className="font-bold text-garland-ink" />,
            ]}
          />
        </Text>
      </View>
      {error ? (
        <Text className="mt-2 text-xs text-garland-berry">
          {t(`photoPicker.errors.${error}`)}
        </Text>
      ) : null}
    </View>
  )
}

// The date of birth: empty until the person picks one, from 120 years ago to
// today.
function BirthDateField({
  value,
  error,
  onChange,
}: {
  value: string
  error: string | undefined
  onChange: (value: string) => void
}) {
  const { t } = useTranslation()
  const today = todayUtc()
  return (
    <View className="mt-6">
      <DateField
        label={t('firstLogin.birthDateLabel')}
        placeholder={t('firstLogin.birthDatePlaceholder')}
        value={value}
        onChange={onChange}
        minimumDate={earliestBirthDate(today)}
        maximumDate={today}
      />
      {error ? (
        <Text className="text-xs text-garland-berry">{error}</Text>
      ) : (
        <Text className="text-[11px] text-garland-ink-40">
          {t('firstLogin.birthDateHint')}
        </Text>
      )}
    </View>
  )
}
