import type { MeteorError } from '@meteorrn/core'
import type { CreateEventArgs, EventParticipantInput } from '@prezentowo/types'
import { router } from 'expo-router'
import { useFormik } from 'formik'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as Yup from 'yup'

import { createEvent } from '@/api/events'
import { CloseIcon, LockIcon, PlusIcon } from '@/components/ui/icon'
import { Text } from '@/components/ui/text'
import { type AvatarKey, avatar } from '@/constants/avatars'
import { garland } from '@/constants/colors'
import { Avatar } from '@/ui/components/Avatar'
import {
  AvatarPickerModal,
  type AvatarPickerModalHandle,
} from '@/ui/components/AvatarPickerModal'
import { GarlandButton, GarlandButtonText } from '@/ui/components/GarlandButton'
import { GarlandField } from '@/ui/components/GarlandField'

type Participant =
  | {
      id: string
      kind: 'real'
      name: string
      avatar: AvatarKey
      host?: boolean
    }
  | {
      id: string
      kind: 'placeholder'
      name: string
      initial: string
      color: string
      avatar?: AvatarKey
    }

const PLACEHOLDER_COLORS = [garland.berry, garland.amber, garland.green]

const INITIAL_PARTICIPANTS: Participant[] = [
  { id: 'host', kind: 'real', name: 'You', avatar: 'm1', host: true },
]

type FormValues = {
  title: string
  date: string
  participants: Participant[]
}

export function CreateEventScreen() {
  const { t } = useTranslation()
  const [newName, setNewName] = useState('')
  const [avatarTargetId, setAvatarTargetId] = useState<string | null>(null)
  const newNameInputRef = useRef<TextInput>(null)
  const avatarPickerRef = useRef<AvatarPickerModalHandle>(null)

  const validationSchema = Yup.object({
    title: Yup.string().trim().required(t('common.required')),
    date: Yup.string().trim().required(t('common.required')),
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
    setErrors,
  } = useFormik<FormValues>({
    initialValues: {
      title: '',
      date: '',
      participants: INITIAL_PARTICIPANTS,
    },
    validationSchema,
    onSubmit: (formValues, { setSubmitting }) => {
      const args: CreateEventArgs = {
        title: formValues.title,
        date: formValues.date,
        participants: formValues.participants
          .filter(p => !(p.kind === 'real' && p.host))
          .map<EventParticipantInput>(p =>
            p.kind === 'real'
              ? { kind: 'real', userId: p.id }
              : { kind: 'placeholder', name: p.name, color: p.color },
          ),
      }
      createEvent(args)
        .then(() => {
          setSubmitting(false)
          router.back()
        })
        .catch((err: MeteorError) => {
          setSubmitting(false)
          setErrors({
            title:
              err.reason ??
              err.error?.toString() ??
              t('common.somethingWentWrong'),
          })
        })
    },
  })

  const addParticipant = () => {
    const name = newName.trim()
    if (!name) return
    const initial = name.charAt(0).toUpperCase()
    const color =
      PLACEHOLDER_COLORS[
        values.participants.length % PLACEHOLDER_COLORS.length
      ]!
    const next: Participant = {
      id: `p-${Date.now()}`,
      kind: 'placeholder',
      name,
      initial,
      color,
    }
    setFieldValue('participants', [...values.participants, next])
    setNewName('')
    newNameInputRef.current?.clear()
  }

  const removeParticipant = (id: string) => {
    setFieldValue(
      'participants',
      values.participants.filter(p => p.id !== id),
    )
  }

  const setParticipantAvatar = (id: string, key: AvatarKey) => {
    setFieldValue(
      'participants',
      values.participants.map(p =>
        p.id === id && p.kind === 'placeholder' ? { ...p, avatar: key } : p,
      ),
    )
  }

  const openAvatarPicker = (id: string) => {
    setAvatarTargetId(id)
    avatarPickerRef.current?.present()
  }

  const avatarTarget = values.participants.find(p => p.id === avatarTargetId)
  const avatarTargetValue =
    avatarTarget?.kind === 'placeholder' ? (avatarTarget.avatar ?? null) : null

  return (
    <SafeAreaView className="flex-1 bg-garland-paper">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View className="flex-row items-center justify-between px-[22px] pb-2 pt-3.5">
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text className="text-sm text-garland-ink-60">
              {t('createEvent.cancel')}
            </Text>
          </Pressable>
          <Text className="text-[13px] font-bold uppercase tracking-[1px] text-garland-ink">
            {t('createEvent.headerTitle')}
          </Text>
          <Pressable
            onPress={() => handleSubmit()}
            disabled={isSubmitting}
            hitSlop={12}
          >
            <Text className="text-sm font-bold text-garland-green">
              {t('createEvent.create')}
            </Text>
          </Pressable>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            paddingTop: 4,
            paddingHorizontal: 22,
            paddingBottom: 24,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text className="mb-[22px] mt-1.5 font-garland-display text-[28px] leading-[31px] text-garland-ink">
            {t('createEvent.title')}
          </Text>

          <GarlandField
            label={t('createEvent.titleLabel')}
            value={values.title}
            onChangeText={handleChange('title')}
            onBlur={handleBlur('title')}
            placeholder={t('createEvent.titlePlaceholder')}
            errorMessage={
              touched.title && errors.title ? errors.title : undefined
            }
          />
          <GarlandField
            label={t('createEvent.dateLabel')}
            value={values.date}
            onChangeText={handleChange('date')}
            onBlur={handleBlur('date')}
            placeholder={t('createEvent.datePlaceholder')}
            errorMessage={touched.date && errors.date ? errors.date : undefined}
          />

          <View className="mt-1.5">
            <View className="mb-2.5 flex-row items-baseline justify-between">
              <Text className="text-[11px] font-bold uppercase tracking-[1.1px] text-garland-ink-40">
                {t('createEvent.peopleCount', {
                  peopleCount: values.participants.length,
                })}
              </Text>
            </View>

            <View className="border-t border-garland-ink-08">
              {values.participants.map(p => (
                <ParticipantRow
                  key={p.id}
                  participant={p}
                  onRemove={() => removeParticipant(p.id)}
                  onPickAvatar={
                    p.kind === 'placeholder'
                      ? () => openAvatarPicker(p.id)
                      : undefined
                  }
                />
              ))}

              <View className="flex-row items-center gap-3 py-3.5">
                <View className="size-9 items-center justify-center rounded-full border-[1.5px] border-dashed border-garland-ink-15">
                  <PlusIcon width={14} height={14} color={garland.ink40} />
                </View>
                <TextInput
                  ref={newNameInputRef}
                  value={newName}
                  onChangeText={setNewName}
                  onSubmitEditing={addParticipant}
                  returnKeyType="done"
                  placeholder={t('createEvent.participantPlaceholder')}
                  placeholderTextColor={garland.ink40}
                  className="flex-1 px-3.5 py-2.5 text-sm text-garland-ink"
                />
              </View>
            </View>

            <View className="mt-3">
              <GarlandButton
                variant="outline"
                onPress={addParticipant}
                disabled={!newName.trim()}
              >
                <GarlandButtonText>{t('createEvent.add')}</GarlandButtonText>
              </GarlandButton>
            </View>

            <View className="mt-4 flex-row items-start gap-2.5 rounded-xl bg-garland-paper2 p-3.5">
              <View className="mt-0.5">
                <LockIcon width={14} height={14} color={garland.green} />
              </View>
              <Text className="flex-1 text-xs leading-[18px] text-garland-ink-60">
                {t('createEvent.placeholderInfo')}
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <AvatarPickerModal
        ref={avatarPickerRef}
        value={avatarTargetValue}
        onConfirm={key => {
          if (avatarTargetId) setParticipantAvatar(avatarTargetId, key)
        }}
      />
    </SafeAreaView>
  )
}

function ParticipantRow({
  participant,
  onRemove,
  onPickAvatar,
}: {
  participant: Participant
  onRemove: () => void
  onPickAvatar?: () => void
}) {
  const { t } = useTranslation()
  const isHost = participant.kind === 'real' && participant.host
  return (
    <View className="flex-row items-center gap-3 border-b border-garland-ink-08 py-3">
      {participant.kind === 'real' ? (
        <Avatar source={avatar(participant.avatar)} size={36} />
      ) : (
        <Pressable
          onPress={onPickAvatar}
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
        >
          {participant.avatar ? (
            <Avatar source={avatar(participant.avatar)} size={36} />
          ) : (
            <View
              className="size-9 items-center justify-center rounded-full"
              style={{ backgroundColor: participant.color }}
            >
              <Text className="text-sm font-bold text-white">
                {participant.initial}
              </Text>
            </View>
          )}
        </Pressable>
      )}
      <View className="min-w-0 flex-1">
        <View className="flex-row items-center gap-2">
          <Text className="text-sm font-bold text-garland-ink">
            {participant.name}
          </Text>
          {isHost ? (
            <Text className="text-[10px] font-bold uppercase tracking-[1px] text-garland-green">
              {t('createEvent.host')}
            </Text>
          ) : null}
        </View>
        <Text className="mt-0.5 text-[11px] text-garland-ink-40">
          {participant.kind === 'real'
            ? t('createEvent.userRole')
            : t('createEvent.placeholderRole')}
        </Text>
      </View>
      {isHost ? null : (
        <Pressable onPress={onRemove} hitSlop={10}>
          <CloseIcon width={16} height={16} color={garland.ink40} />
        </Pressable>
      )}
    </View>
  )
}
