import type { InvitePreview } from '@prezentowo/types'
import { type Href, router } from 'expo-router'
import { type ReactNode, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, ScrollView, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { joinEvent } from '@/api/events'
import { findInvitePreview, ignoreInvite } from '@/api/invites'
import { CheckIcon } from '@/components/ui/icon'
import { Text } from '@/components/ui/text'
import { garland } from '@/constants/colors'
import { useMyEvents } from '@/hooks/useMyEvents'
import { errorMessage } from '@/localization/errorMessage'
import { eventWhen } from '@/localization/eventDates'
import i18n from '@/localization/i18n'
import { savePendingInvite } from '@/store/pendingInvite'
import { useAuthStore } from '@/store/useAuthStore'
import {
  type MeteorError,
  useSubscription,
  useSyncStatus,
  useTracker,
} from '@/sync'
import { EventBackground } from '@/ui/components/EventBackground'
import { GarlandButton, GarlandButtonText } from '@/ui/components/GarlandButton'
import { ParticipantAvatar } from '@/ui/components/ParticipantAvatar'
import { ScreenHeader } from '@/ui/components/ScreenHeader'

// `null` is "no, I'm new"; `undefined` is no answer yet.
type Choice = string | null | undefined

const openEvent = (eventId: string) =>
  router.replace({ pathname: '/event/[eventId]', params: { eventId } })

// `7a`: an invite, readable signed in or out. Joining signed in enters the
// event; signed out it's kept as the pending invite and runs once the app
// opens after sign-in. Ignore goes back where the guards allow.
export function InviteScreen({ code }: { code: string }) {
  const { t } = useTranslation()
  const status = useSyncStatus()
  const ready = useSubscription('invites.byCode', [code])
  const preview = useTracker(() => findInvitePreview(code), [code])

  const userToken = useAuthStore(s => s.userToken)
  const firstLoginPending = useAuthStore(s => s.firstLoginPending)
  const hasCompletedOnboarding = useAuthStore(s => s.hasCompletedOnboarding)
  const appOpen = !!userToken && !firstLoginPending
  const { events } = useMyEvents()

  // Wherever the guards let this person be right now.
  const home: Href = appOpen
    ? '/'
    : userToken
      ? '/first-login'
      : hasCompletedOnboarding
        ? '/welcome'
        : '/onboarding'
  const leave = () => router.dismissTo(home)

  const body = (() => {
    if (status === 'offline') return <Message text={t('invite.offline')} />
    if (preview) {
      return (
        <InviteBody
          preview={preview}
          appOpen={appOpen}
          isMember={appOpen && events.some(e => e._id === preview.eventId)}
          leave={leave}
        />
      )
    }
    return <Message text={ready ? t('invite.notFound') : t('invite.loading')} />
  })()

  return (
    <SafeAreaView className="flex-1 bg-garland-paper">
      <ScreenHeader title={t('invite.title')} variant="modal" onClose={leave} />
      {body}
    </SafeAreaView>
  )
}

function Message({ text }: { text: string }) {
  return (
    <View className="flex-1 items-center justify-center px-7">
      <Text className="text-center text-sm text-garland-ink-60">{text}</Text>
    </View>
  )
}

function InviteBody({
  preview,
  appOpen,
  isMember,
  leave,
}: {
  preview: InvitePreview
  appOpen: boolean
  isMember: boolean
  leave: () => void
}) {
  const { t, i18n } = useTranslation()
  const [choice, setChoice] = useState<Choice>(undefined)
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { code, eventId, unclaimedPlaceholders: placeholders } = preview
  // The one they picked may have just been claimed by someone else.
  const picked =
    typeof choice === 'string' && !placeholders.some(p => p.id === choice)
      ? undefined
      : choice
  const answered = placeholders.length === 0 || picked !== undefined

  const { date, countdown } = eventWhen(
    t,
    i18n.language,
    preview.date,
    new Date(),
  )
  const when = [date, countdown].filter(Boolean).join(' · ')

  const join = async () => {
    const invite = picked ? { code, participantId: picked } : { code }
    setError(null)
    if (!appOpen) {
      await savePendingInvite(invite)
      leave()
      return
    }
    setJoining(true)
    try {
      await joinEvent(invite)
      openEvent(eventId)
    } catch (e) {
      // Already in (e.g. their events hadn't loaded yet): just go there.
      if ((e as Partial<MeteorError>).reason === 'alreadyAParticipant') {
        openEvent(eventId)
        return
      }
      setJoining(false)
      setError(joinErrorMessage(e))
    }
  }

  const ignore = () => {
    // Nothing to remember for someone without an account yet.
    if (appOpen) ignoreInvite(code).catch(() => {})
    leave()
  }

  return (
    <>
      <ScrollView
        contentContainerClassName="px-[22px] pb-6 pt-2"
        showsVerticalScrollIndicator={false}
      >
        <View className="overflow-hidden rounded-2xl">
          <EventBackground
            event={{ _id: eventId, background: preview.background }}
            height={120}
          />
        </View>
        <Text className="mt-5 text-sm text-garland-ink-60">
          {preview.inviterName
            ? t('invite.invitedBy', { name: preview.inviterName })
            : t('invite.invited')}
        </Text>
        <Text className="mt-1 font-garland-display text-[28px] leading-[34px] text-garland-ink">
          {preview.title}
        </Text>
        <Text className="mt-1 text-[13px] text-garland-ink-60">{when}</Text>

        {!isMember && placeholders.length > 0 ? (
          <View className="mt-7">
            <Text className="mb-1 text-[15px] font-bold text-garland-ink">
              {t('invite.areYouOneOf')}
            </Text>
            <Text className="mb-3 text-[13px] text-garland-ink-60">
              {t('invite.placeholderHint')}
            </Text>
            <View className="gap-2">
              {placeholders.map(p => (
                <ChoiceRow
                  key={p.id}
                  label={p.name}
                  selected={picked === p.id}
                  onPress={() => setChoice(p.id)}
                  avatar={
                    <ParticipantAvatar
                      name={p.name}
                      avatarKey={p.avatar}
                      color={p.color}
                      size={32}
                    />
                  }
                />
              ))}
              <ChoiceRow
                label={t('invite.imNew')}
                selected={picked === null}
                onPress={() => setChoice(null)}
              />
            </View>
          </View>
        ) : null}

        <Text className="mt-6 text-[13px] leading-[19px] text-garland-ink-60">
          {isMember ? t('invite.alreadyMember') : t('invite.nameVisible')}
        </Text>
        {error ? (
          <Text className="mt-3 text-[13px] text-garland-berry">{error}</Text>
        ) : null}
      </ScrollView>

      <View className="gap-3 px-[22px] pb-4 pt-2">
        {isMember ? (
          <GarlandButton onPress={() => openEvent(eventId)}>
            <GarlandButtonText>{t('invite.openEvent')}</GarlandButtonText>
          </GarlandButton>
        ) : (
          <>
            <GarlandButton
              onPress={join}
              disabled={!answered}
              loading={joining}
              // GarlandButton doesn't dim itself when disabled.
              className={answered ? undefined : 'opacity-40'}
            >
              <GarlandButtonText>{t('invite.join')}</GarlandButtonText>
            </GarlandButton>
            <GarlandButton
              variant="outline"
              onPress={ignore}
              disabled={joining}
            >
              <GarlandButtonText>{t('invite.ignore')}</GarlandButtonText>
            </GarlandButton>
          </>
        )}
      </View>
    </>
  )
}

function ChoiceRow({
  label,
  selected,
  onPress,
  avatar,
}: {
  label: string
  selected: boolean
  onPress: () => void
  avatar?: ReactNode
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      className={`min-h-[52px] flex-row items-center gap-3 rounded-2xl border-[1.5px] px-3.5 py-2.5 active:opacity-70 ${
        selected
          ? 'border-garland-ink bg-garland-paper2'
          : 'border-garland-ink-15'
      }`}
    >
      {avatar}
      <Text className="flex-1 text-[15px] font-semibold text-garland-ink">
        {label}
      </Text>
      {selected ? (
        <CheckIcon width={18} height={18} color={garland.ink} />
      ) : null}
    </Pressable>
  )
}

const JOIN_ERRORS: Record<string, string> = {
  inviteNotFound: 'invite.notFound',
  placeholderNotFound: 'invite.placeholderTaken',
  mustBeAPlaceholder: 'invite.placeholderTaken',
}

function joinErrorMessage(error: unknown): string {
  const reason = (error as Partial<MeteorError> | undefined)?.reason
  const key = typeof reason === 'string' ? JOIN_ERRORS[reason] : undefined
  return key
    ? i18n.t(key)
    : errorMessage(error, i18n.t('common.somethingWentWrong'))
}
