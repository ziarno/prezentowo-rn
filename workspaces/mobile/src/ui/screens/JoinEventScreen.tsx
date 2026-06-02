import type { MeteorError } from '@meteorrn/core'
import type { EventDoc } from '@prezentowo/types'
import { router } from 'expo-router'
import { type ReactNode, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, ScrollView, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { joinEvent } from '@/api/events'
import { BackIcon } from '@/components/ui/icon'
import { Text } from '@/components/ui/text'
import { avatar } from '@/constants/avatars'
import { garland } from '@/constants/colors'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useEventById } from '@/hooks/useEventById'
import { Avatar } from '@/ui/components/Avatar'
import { GarlandButton, GarlandButtonText } from '@/ui/components/GarlandButton'

const NEW_PICK = '__new__'

export type JoinEventScreenProps = {
  signedIn?: boolean
  eventId?: string
}

export function JoinEventScreen({
  signedIn = true,
  eventId,
}: JoinEventScreenProps) {
  if (!signedIn) return <JoinEventSignIn eventId={eventId} />
  return <JoinEventPick eventId={eventId} />
}

function JoinEventSignIn({ eventId }: { eventId?: string }) {
  const { t } = useTranslation()
  const event = useEventById(eventId)

  if (!eventId) {
    return <JoinEventMissing message={t('join.noEventProvided')} />
  }
  if (!event) {
    return <JoinEventMissing message={t('join.loadingEvent')} />
  }

  const participantCount = event.participants.length
  const placeholderColors = event.participants
    .filter(
      (p): p is Extract<typeof p, { kind: 'placeholder' }> =>
        p.kind === 'placeholder',
    )
    .slice(0, 5)
    .map(p => p.color)

  return (
    <SafeAreaView className="flex-1 bg-garland-paper">
      <View className="flex-1 px-7">
        <View className="h-12 py-3.5" />

        <View className="flex-1 justify-center">
          <Text className="text-[11px] font-bold uppercase tracking-[1.1px] text-garland-ink-40">
            {t('join.invitedTo')}
          </Text>
          <Text className="mt-2 font-garland-display text-[40px] leading-[41px] text-garland-ink">
            {event.title}
          </Text>
          <View className="my-5 h-0.5 w-9 bg-garland-green" />
          <Text className="text-sm leading-[22px] text-garland-ink-60">
            {event.date}
            {'\n'}
            {t('join.peopleOnList', { participantCount })}
          </Text>

          {placeholderColors.length > 0 ? (
            <View className="mt-5 flex-row items-center gap-3.5">
              <View className="flex-row">
                {placeholderColors.map((color, i) => (
                  <View
                    key={`${color}-${i}`}
                    className="size-8 rounded-full border-2 border-garland-paper"
                    style={{
                      backgroundColor: color,
                      marginLeft: i === 0 ? 0 : -10,
                    }}
                  />
                ))}
              </View>
              <Text className="text-xs text-garland-ink-60">
                {t('join.spotsWaiting', {
                  spots: placeholderColors.length,
                })}
              </Text>
            </View>
          ) : null}
        </View>

        <View className="gap-2.5 pb-9">
          <Text className="text-center text-xs text-garland-ink-60">
            {t('join.signInToJoin')}
          </Text>
          <GarlandButton onPress={() => router.replace('/welcome')}>
            <GarlandButtonText>{t('join.signInToContinue')}</GarlandButtonText>
          </GarlandButton>
        </View>
      </View>
    </SafeAreaView>
  )
}

function JoinEventPick({ eventId }: { eventId?: string }) {
  const { t } = useTranslation()
  const event = useEventById(eventId)
  const user = useCurrentUser()

  const placeholders = useMemo(
    () =>
      event?.participants.filter(p => p.kind === 'placeholder') ??
      ([] as Extract<
        EventDoc['participants'][number],
        { kind: 'placeholder' }
      >[]),
    [event],
  )

  const alreadyJoined = useMemo(
    () =>
      !!user &&
      !!event &&
      event.participants.some(p => p.kind === 'real' && p.userId === user._id),
    [user, event],
  )

  const [picked, setPicked] = useState<string>(NEW_PICK)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!eventId) {
    return <JoinEventMissing message={t('join.noEventProvided')} />
  }
  if (!event) {
    return <JoinEventMissing message={t('join.loadingEvent')} />
  }

  const pickedPlaceholder =
    picked === NEW_PICK
      ? null
      : (placeholders.find(p => p.id === picked) ?? null)

  const handleJoin = () => {
    if (submitting) return
    setError(null)
    setSubmitting(true)
    joinEvent({ eventId, participantId: pickedPlaceholder?.id })
      .then(() => {
        setSubmitting(false)
        router.replace('/')
      })
      .catch((err: MeteorError) => {
        setSubmitting(false)
        setError(
          err.reason ?? err.error?.toString() ?? t('common.somethingWentWrong'),
        )
      })
  }

  return (
    <SafeAreaView className="flex-1 bg-garland-paper">
      <View className="flex-1">
        <View className="flex-row justify-between px-[22px] pt-3.5">
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <BackIcon width={22} height={22} color={garland.ink} />
          </Pressable>
        </View>

        <View className="px-[22px] pb-4 pt-1.5">
          <Text className="text-[11px] font-bold uppercase tracking-[1.1px] text-garland-ink-40">
            {event.title}
          </Text>
          <Text className="mt-1.5 font-garland-display text-[30px] leading-[32px] text-garland-ink">
            {alreadyJoined
              ? t('join.alreadyIn')
              : placeholders.length > 0
                ? t('join.areYouOneOfThese')
                : t('join.joinThisEvent')}
          </Text>
          <Text className="mt-2.5 text-sm leading-[21px] text-garland-ink-60">
            {alreadyJoined
              ? t('join.alreadyParticipant', {
                  title: event.title,
                  date: event.date,
                })
              : placeholders.length > 0
                ? t('join.hostAddedNames')
                : event.date}
          </Text>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 14 }}
          showsVerticalScrollIndicator={false}
        >
          {!alreadyJoined && (
            <View className="border-t border-garland-ink-08">
              {placeholders.map(p => (
                <PickRow
                  key={p.id}
                  selected={picked === p.id}
                  onPress={() => setPicked(p.id)}
                >
                  <View
                    className="size-[38px] items-center justify-center rounded-full"
                    style={{ backgroundColor: p.color }}
                  >
                    <Text className="font-bold text-white">
                      {p.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View className="min-w-0 flex-1">
                    <Text className="text-[15px] font-bold text-garland-ink">
                      {p.name}
                    </Text>
                    <Text className="mt-0.5 text-xs text-garland-ink-40">
                      {t('join.placeholderNotClaimed')}
                    </Text>
                  </View>
                </PickRow>
              ))}

              <PickRow
                selected={picked === NEW_PICK}
                onPress={() => setPicked(NEW_PICK)}
                bordered={false}
              >
                <Avatar source={avatar('m1')} size={38} />
                <View className="min-w-0 flex-1">
                  <Text className="text-[15px] font-bold text-garland-ink">
                    {t('join.addMeAsNew')}
                  </Text>
                  <Text className="mt-0.5 text-xs text-garland-ink-40">
                    {user?.profile?.name
                      ? t('join.joinAs', { name: user.profile.name })
                      : t('join.joinWithAccount')}
                  </Text>
                </View>
              </PickRow>
            </View>
          )}

          {error ? (
            <Text className="mt-3 text-xs text-garland-berry">{error}</Text>
          ) : null}
        </ScrollView>

        <View className="px-[22px] pb-6 pt-2">
          {alreadyJoined ? (
            <GarlandButton onPress={() => router.replace('/')}>
              <GarlandButtonText>{t('join.backToEvents')}</GarlandButtonText>
            </GarlandButton>
          ) : (
            <GarlandButton onPress={handleJoin} disabled={submitting}>
              <GarlandButtonText>
                {pickedPlaceholder
                  ? t('join.joinAs', { name: pickedPlaceholder.name })
                  : t('join.joinTheEvent')}
              </GarlandButtonText>
            </GarlandButton>
          )}
        </View>
      </View>
    </SafeAreaView>
  )
}

function JoinEventMissing({ message }: { message: string }) {
  return (
    <SafeAreaView className="flex-1 bg-garland-paper">
      <View className="flex-1">
        <View className="flex-row justify-between px-[22px] pt-3.5">
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <BackIcon width={22} height={22} color={garland.ink} />
          </Pressable>
        </View>
        <View className="flex-1 items-center justify-center px-7">
          <Text className="text-center text-sm text-garland-ink-60">
            {message}
          </Text>
        </View>
      </View>
    </SafeAreaView>
  )
}

function PickRow({
  children,
  selected,
  onPress,
  bordered = true,
}: {
  children: ReactNode
  selected: boolean
  onPress: () => void
  bordered?: boolean
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center gap-3.5 py-3.5 ${
        bordered ? 'border-b border-garland-ink-08' : ''
      }`}
    >
      {children}
      <View
        className="size-[22px] rounded-full"
        style={{
          borderWidth: selected ? 7 : 1.5,
          borderColor: selected ? garland.green : garland.ink15,
        }}
      />
    </Pressable>
  )
}
