import { Trans, useLingui } from '@lingui/react/macro'
import { useFormik } from 'formik'
import { useState } from 'react'
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

import f1Avatar from '@/assets/images/avatars/f1.png'
import f2Avatar from '@/assets/images/avatars/f2.png'
import f3Avatar from '@/assets/images/avatars/f3.png'
import f4Avatar from '@/assets/images/avatars/f4.png'
import m1Avatar from '@/assets/images/avatars/m1.png'
import m2Avatar from '@/assets/images/avatars/m2.png'
import m3Avatar from '@/assets/images/avatars/m3.png'
import m4Avatar from '@/assets/images/avatars/m4.png'
import checkMarkAsset from '@/assets/svg/check-mark.svg'
import plusIconAsset from '@/assets/svg/plus-icon.svg'
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { garland } from '@/constants/garland'
import { useAuthStore } from '@/store/useAuthStore'
import { AuthField } from '@/ui/components/AuthField'

const AVATARS = ['f1', 'm1', 'f2', 'm2', 'f3', 'm3', 'f4', 'm4'] as const

const AVATAR_SOURCES: Record<(typeof AVATARS)[number], ImageSourcePropType> = {
  f1: f1Avatar,
  f2: f2Avatar,
  f3: f3Avatar,
  f4: f4Avatar,
  m1: m1Avatar,
  m2: m2Avatar,
  m3: m3Avatar,
  m4: m4Avatar,
}

export function FirstLoginScreen() {
  const [selected, setSelected] = useState<(typeof AVATARS)[number] | null>(
    'f1',
  )
  const { t } = useLingui()
  const setFirstLoginPending = useAuthStore(s => s.setFirstLoginPending)

  const validationSchema = Yup.object({
    name: Yup.string()
      .trim()
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
              <Trans>Step 1 · 1</Trans>
            </Text>
            <Button
              variant="link"
              action="default"
              hitSlop={12}
              onPress={() => setFirstLoginPending(false)}
            >
              <ButtonText className="text-[13px] text-garland-ink-60">
                <Trans>Skip</Trans>
              </ButtonText>
            </Button>
          </View>

          <View className="pt-1.5">
            <Text className="text-[11px] font-bold uppercase tracking-[1.1px] text-garland-ink-40">
              <Trans>You&apos;re in.</Trans>
            </Text>
            <Text className="mt-2 font-garland-display text-[34px] leading-[35px] text-garland-ink">
              <Trans>Let&apos;s set you</Trans>
              {'\n'}
              <Trans>up.</Trans>
            </Text>
            <Text className="mt-2.5 text-sm leading-[21px] text-garland-ink-60">
              <Trans>
                How should we show you to friends and family on Prezentowo?
              </Trans>
            </Text>
          </View>

          <View className="mt-6">
            <AuthField
              label={t`Your name`}
              placeholder={t`Alex Kowalski`}
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
              <Trans>Profile picture</Trans>
            </Text>
            <View className="flex-row flex-wrap gap-2.5">
              <UploadTile />
              {AVATARS.map(key => (
                <AvatarTile
                  key={key}
                  source={AVATAR_SOURCES[key]}
                  selected={selected === key}
                  onPress={() => setSelected(key)}
                />
              ))}
            </View>
            <Text className="mt-3 text-xs leading-[18px] text-garland-ink-40">
              <Trans>
                Tap the <Text className="font-bold text-garland-ink">+</Text> to
                upload your own photo, or pick one of ours.
              </Trans>
            </Text>
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
                  <Trans>Continue</Trans>
                </ButtonText>
              )}
            </Button>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function UploadTile() {
  return (
    <Pressable className="basis-[18%] aspect-square items-center justify-center rounded-full border-[1.5px] border-dashed border-[rgba(0,0,0,0.2)] bg-[rgba(0,0,0,0.02)]">
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
    <Pressable onPress={onPress} className="relative basis-[18%] aspect-square">
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
