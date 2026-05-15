import { useFormik } from 'formik'
import { useState } from 'react'
import {
  ActivityIndicator,
  Image,
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
import { useAuthStore } from '@/store/useAuthStore'

const AVATARS = ['f1', 'm1', 'f2', 'm2', 'f3', 'm3', 'f4', 'm4'] as const

const AVATAR_SOURCES: Record<(typeof AVATARS)[number], number> = {
  f1: require('../../../assets/images/avatars/f1.png'),
  f2: require('../../../assets/images/avatars/f2.png'),
  f3: require('../../../assets/images/avatars/f3.png'),
  f4: require('../../../assets/images/avatars/f4.png'),
  m1: require('../../../assets/images/avatars/m1.png'),
  m2: require('../../../assets/images/avatars/m2.png'),
  m3: require('../../../assets/images/avatars/m3.png'),
  m4: require('../../../assets/images/avatars/m4.png'),
}

const validationSchema = Yup.object({
  name: Yup.string().trim().required('Required'),
})

function CheckMark() {
  return (
    <Svg
      width={10}
      height={10}
      viewBox="0 0 24 24"
      fill="none"
      stroke={garland.paper}
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M20 6 9 17l-5-5" />
    </Svg>
  )
}

function PlusIcon() {
  return (
    <Svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      stroke={garland.ink60}
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M12 5v14M5 12h14" />
    </Svg>
  )
}

export function FirstLoginScreen() {
  const [selected, setSelected] = useState<(typeof AVATARS)[number] | null>(
    'f1',
  )
  const setFirstLoginPending = useAuthStore(s => s.setFirstLoginPending)

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
    <SafeAreaView className="flex-1" style={{ backgroundColor: garland.paper }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View className="flex-1 px-7">
          <View className="flex-row items-center justify-between py-3.5">
            <Text
              className="font-bold uppercase"
              style={{ fontSize: 12, color: garland.ink40, letterSpacing: 1 }}
            >
              Step 1 · 1
            </Text>
            <Pressable
              hitSlop={12}
              onPress={() => {
                setFirstLoginPending(false)
              }}
            >
              <Text style={{ fontSize: 13, color: garland.ink60 }}>Skip</Text>
            </Pressable>
          </View>

          <View className="pt-1.5">
            <Text
              className="font-bold uppercase"
              style={{ fontSize: 11, color: garland.ink40, letterSpacing: 1.1 }}
            >
              {`You're in.`}
            </Text>
            <Text
              className="mt-2"
              style={{
                fontFamily: displayFont,
                fontSize: 34,
                lineHeight: 35,
                color: garland.ink,
              }}
            >
              {`Let's set you\nup.`}
            </Text>
            <Text
              className="mt-2.5"
              style={{ fontSize: 14, lineHeight: 21, color: garland.ink60 }}
            >
              How should we show you to friends and family on Prezentowo?
            </Text>
          </View>

          <View className="mt-6">
            <AuthField
              label="Your name"
              placeholder="Alex Kowalski"
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
            <Text
              className="font-bold uppercase"
              style={{
                fontSize: 11,
                color: garland.ink40,
                letterSpacing: 1.1,
                marginBottom: 12,
              }}
            >
              Profile picture
            </Text>
            <View className="flex-row flex-wrap" style={{ gap: 10 }}>
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
            <Text
              className="mt-3"
              style={{ fontSize: 12, color: garland.ink40, lineHeight: 18 }}
            >
              Tap the{' '}
              <Text style={{ color: garland.ink, fontWeight: '700' }}>+</Text>{' '}
              to upload your own photo, or pick one of ours.
            </Text>
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
                  className="text-center"
                  style={{
                    color: garland.paper,
                    fontSize: 16,
                    fontWeight: '600',
                  }}
                >
                  Continue
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

// Grid is 5 columns wide. With 28px horizontal padding and 10px gaps, each
// tile lands at ~(screen - 56 - 40) / 5. We compute via flexBasis so the row
// wraps to 4 + 5 = 9 tiles cleanly.
const TILE_BASIS = '18%' as const

function UploadTile() {
  return (
    <Pressable
      style={{
        flexBasis: TILE_BASIS,
        aspectRatio: 1,
        borderRadius: 999,
        borderWidth: 1.5,
        borderColor: 'rgba(0,0,0,0.2)',
        borderStyle: 'dashed',
        backgroundColor: 'rgba(0,0,0,0.02)',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <PlusIcon />
    </Pressable>
  )
}

function AvatarTile({
  source,
  selected,
  onPress,
}: {
  source: number
  selected: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexBasis: TILE_BASIS,
        aspectRatio: 1,
        position: 'relative',
      }}
    >
      <View
        style={{
          width: '100%',
          height: '100%',
          borderRadius: 999,
          overflow: 'hidden',
          borderWidth: 2.5,
          borderColor: selected ? garland.green : 'transparent',
          padding: selected ? 2 : 0,
          backgroundColor: 'rgba(0,0,0,0.02)',
        }}
      >
        <Image
          source={source}
          style={{ width: '100%', height: '100%', borderRadius: 999 }}
          resizeMode="cover"
        />
      </View>
      {selected && (
        <View
          style={{
            position: 'absolute',
            right: -2,
            bottom: -2,
            width: 18,
            height: 18,
            borderRadius: 999,
            backgroundColor: garland.green,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 2,
            borderColor: garland.paper,
          }}
        >
          <CheckMark />
        </View>
      )}
    </Pressable>
  )
}
