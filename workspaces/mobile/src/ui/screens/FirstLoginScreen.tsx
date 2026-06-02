import { useFormik } from 'formik'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import {
  Image,
  type ImageSourcePropType,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LocalSvg } from 'react-native-svg/css'
import * as Yup from 'yup'

import checkMarkAsset from '@/assets/svg/check-mark.svg'
import plusIconAsset from '@/assets/svg/plus-icon.svg'
import { Text } from '@/components/ui/text'
import { AVATAR_KEYS, type AvatarKey, avatar } from '@/constants/avatars'
import { useAuthStore } from '@/store/useAuthStore'
import { AuthField } from '@/ui/components/AuthField'
import { GarlandButton, GarlandButtonText } from '@/ui/components/GarlandButton'
import { LanguageChangeButton } from '@/ui/components/LanguageChangeButton'

export function FirstLoginScreen() {
  const [selected, setSelected] = useState<AvatarKey | null>('f1')
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
            <View className="-mx-1.5 flex-row flex-wrap">
              <GridCell>
                <UploadTile />
              </GridCell>
              {AVATAR_KEYS.map(key => (
                <GridCell key={key}>
                  <AvatarTile
                    source={avatar(key)}
                    selected={selected === key}
                    onPress={() => setSelected(key)}
                  />
                </GridCell>
              ))}
            </View>
            <Text className="mt-3 text-xs leading-[18px] text-garland-ink-40">
              <Trans
                i18nKey="firstLogin.uploadHint"
                components={[
                  <Text key="plus" className="font-bold text-garland-ink" />,
                ]}
              />
            </Text>
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
    </SafeAreaView>
  )
}

function GridCell({ children }: { children: ReactNode }) {
  return (
    <View style={{ width: '20%' }} className="p-1.5">
      {children}
    </View>
  )
}

function UploadTile() {
  return (
    <Pressable className="aspect-square items-center justify-center rounded-full border-[1.5px] border-dashed border-[rgba(0,0,0,0.2)] bg-[rgba(0,0,0,0.02)]">
      <LocalSvg asset={plusIconAsset} width={20} height={20} />
    </Pressable>
  )
}

function AvatarTile({
  source,
  selected,
  onPress,
}: {
  source: ImageSourcePropType
  selected: boolean
  onPress: () => void
}) {
  return (
    <Pressable onPress={onPress} className="relative aspect-square">
      <View
        className={`size-full overflow-hidden rounded-full border-[2.5px] bg-[rgba(0,0,0,0.02)] ${
          selected ? 'border-garland-green p-0.5' : 'border-transparent'
        }`}
      >
        <Image
          source={source}
          className="size-full rounded-full"
          resizeMode="cover"
        />
      </View>
      {selected && (
        <View className="absolute -bottom-0.5 -right-0.5 h-[18px] w-[18px] items-center justify-center rounded-full border-2 border-garland-paper bg-garland-green">
          <LocalSvg asset={checkMarkAsset} width={10} height={10} />
        </View>
      )}
    </Pressable>
  )
}
