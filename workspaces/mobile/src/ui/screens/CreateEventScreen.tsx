import { Trans, useLingui } from '@lingui/react/macro'
import type { MeteorError } from '@meteorrn/core'
import type { CreateEventArgs, EventParticipantInput } from '@prezentowo/types'
import { router } from 'expo-router'
import { useFormik } from 'formik'
import { useRef, useState } from 'react'
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
  const { t } = useLingui()
  const [newName, setNewName] = useState('')
  const newNameInputRef = useRef<TextInput>(null)

  const validationSchema = Yup.object({
    title: Yup.string()
      .trim()
      .required(t`Required`),
    date: Yup.string()
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
              err.reason ?? err.error?.toString() ?? t`Something went wrong`,
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

  return (
    <SafeAreaView className="flex-1 bg-garland-paper">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View className="flex-row items-center justify-between px-[22px] pb-2 pt-3.5">
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text className="text-sm text-garland-ink-60">
              <Trans>Cancel</Trans>
            </Text>
          </Pressable>
          <Text className="text-[13px] font-bold uppercase tracking-[1px] text-garland-ink">
            <Trans>New event</Trans>
          </Text>
          <Pressable
            onPress={() => handleSubmit()}
            disabled={isSubmitting}
            hitSlop={12}
          >
            <Text className="text-sm font-bold text-garland-green">
              <Trans>Create</Trans>
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
            <Trans>New event.</Trans>
          </Text>

          <GarlandField
            label={t`Title`}
            value={values.title}
            onChangeText={handleChange('title')}
            onBlur={handleBlur('title')}
            placeholder={t`Name your event`}
            errorMessage={
              touched.title && errors.title ? errors.title : undefined
            }
          />
          <GarlandField
            label={t`Date`}
            value={values.date}
            onChangeText={handleChange('date')}
            onBlur={handleBlur('date')}
            placeholder={t`December 24, 2026`}
            errorMessage={touched.date && errors.date ? errors.date : undefined}
          />

          <View className="mt-1.5">
            <View className="mb-2.5 flex-row items-baseline justify-between">
              <Text className="text-[11px] font-bold uppercase tracking-[1.1px] text-garland-ink-40">
                <Trans>People · {values.participants.length}</Trans>
              </Text>
            </View>

            <View className="border-t border-garland-ink-08">
              {values.participants.map(p => (
                <ParticipantRow
                  key={p.id}
                  participant={p}
                  onRemove={() => removeParticipant(p.id)}
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
                  placeholder={t`Name, email, or @username…`}
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
                <GarlandButtonText>
                  <Trans>Add</Trans>
                </GarlandButtonText>
              </GarlandButton>
            </View>

            <View className="mt-4 flex-row items-start gap-2.5 rounded-xl bg-garland-paper2 p-3.5">
              <View className="mt-0.5">
                <LockIcon width={14} height={14} color={garland.green} />
              </View>
              <Text className="flex-1 text-xs leading-[18px] text-garland-ink-60">
                <Trans>
                  Placeholder names let you plan for people not on Prezentowo
                  yet. Anyone you share the invite link with can claim a
                  placeholder.
                </Trans>
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function ParticipantRow({
  participant,
  onRemove,
}: {
  participant: Participant
  onRemove: () => void
}) {
  const isHost = participant.kind === 'real' && participant.host
  return (
    <View className="flex-row items-center gap-3 border-b border-garland-ink-08 py-3">
      {participant.kind === 'real' ? (
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
      <View className="min-w-0 flex-1">
        <View className="flex-row items-center gap-2">
          <Text className="text-sm font-bold text-garland-ink">
            {participant.name}
          </Text>
          {isHost ? (
            <Text className="text-[10px] font-bold uppercase tracking-[1px] text-garland-green">
              <Trans>— host</Trans>
            </Text>
          ) : null}
        </View>
        <Text className="mt-0.5 text-[11px] text-garland-ink-40">
          {participant.kind === 'real' ? (
            <Trans>User</Trans>
          ) : (
            <Trans>Placeholder · can be claimed via invite link</Trans>
          )}
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
