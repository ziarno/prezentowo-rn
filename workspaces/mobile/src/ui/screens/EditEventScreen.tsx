import * as Clipboard from 'expo-clipboard'
import { router } from 'expo-router'
import { type ReactNode, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, Pressable, ScrollView, Share, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import type { WizardStep } from '@/api/eventWizard'
import { beneficiaryIdOf, deleteEvent, removeParticipant } from '@/api/events'
import { inviteLink, rotateInvite } from '@/api/invites'
import type { ResolvedParticipant } from '@/api/participants'
import { ArrowRightIcon, LockIcon } from '@/components/ui/icon'
import { Text } from '@/components/ui/text'
import { garland } from '@/constants/colors'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useEventById } from '@/hooks/useEventById'
import { useEventGifts } from '@/hooks/useEventGifts'
import { useEventInvite } from '@/hooks/useEventInvite'
import { useEventParticipants } from '@/hooks/useEventParticipants'
import { useOffline } from '@/hooks/useOffline'
import { formatEventDate } from '@/localization/eventDates'
import { isNetworkError } from '@/sync'
import { EventBackground } from '@/ui/components/EventBackground'
import { GarlandButton, GarlandButtonText } from '@/ui/components/GarlandButton'
import { LockNote } from '@/ui/components/LockNote'
import { ParticipantAvatar } from '@/ui/components/ParticipantAvatar'
import { ScreenHeader } from '@/ui/components/ScreenHeader'

const COVER_HEIGHT = 140

// `6a`: everything creation set, each row reopening the wizard at its step,
// plus the people and the invite link. Creator only.
export function EditEventScreen({ eventId }: { eventId: string }) {
  const { t, i18n } = useTranslation()
  const offline = useOffline()
  const user = useCurrentUser()
  const { event, ready } = useEventById(eventId)
  const { participants, resolve } = useEventParticipants(eventId)
  const { gifts, ready: giftsReady } = useEventGifts(eventId)
  const invite = useEventInvite(eventId)

  if (!event || !user || event.ownerId !== user._id) {
    return (
      <SafeAreaView className="flex-1 bg-garland-paper">
        <ScreenHeader title={t('shell.editEvent')} />
        <View className="flex-1 items-center justify-center px-7">
          <Text className="text-center text-sm text-garland-ink-60">
            {!ready
              ? t('createEvent.loading')
              : event
                ? t('editEvent.creatorOnly')
                : t('createEvent.notFound')}
          </Text>
        </View>
      </SafeAreaView>
    )
  }

  // Presents are given to someone, so who gets them can't change under
  // them. Only the gifts this viewer may see count; the server has the last
  // word on the rest.
  // Until they've arrived the rows stay locked rather than flash open.
  const hasGifts = gifts.length > 0
  const kindLocked = hasGifts || !giftsReady
  const beneficiaryId = beneficiaryIdOf(event)
  const beneficiary = beneficiaryId ? resolve(beneficiaryId) : undefined

  const openStep = (step: WizardStep) =>
    router.push({ pathname: '/create-event', params: { eventId, step } })

  return (
    <SafeAreaView className="flex-1 bg-garland-paper">
      <ScreenHeader title={t('shell.editEvent')} />
      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Dimmed, not hidden, while offline: nothing here works without
            the server. */}
        <View
          pointerEvents={offline ? 'none' : 'auto'}
          className={offline ? 'opacity-40' : undefined}
        >
          <Pressable
            onPress={() => openStep('background')}
            accessibilityRole="button"
            accessibilityLabel={t('editEvent.background')}
            className="mx-[22px] mt-2 overflow-hidden rounded-2xl active:opacity-70"
          >
            <EventBackground event={event} height={COVER_HEIGHT} />
            <View className="absolute bottom-2.5 right-2.5 rounded-full bg-garland-paper px-3 py-1.5">
              <Text className="text-xs font-bold text-garland-ink">
                {t('editEvent.changeBackground')}
              </Text>
            </View>
          </Pressable>

          <Section>
            <EditRow
              label={t('createEvent.details.nameLabel')}
              value={event.title}
              onPress={() => openStep('details')}
            />
            <EditRow
              label={t('createEvent.details.dateLabel')}
              value={formatEventDate(i18n.language, event.date)}
              onPress={() => openStep('details')}
            />
            <EditRow
              label={t('editEvent.type')}
              value={
                event.type === 'many-to-one'
                  ? t('createEvent.kind.manyToOne')
                  : t('createEvent.kind.manyToMany')
              }
              onPress={() => openStep('kind')}
              locked={kindLocked}
            />
            {event.type === 'many-to-one' ? (
              <EditRow
                label={t('editEvent.for')}
                value={beneficiary?.name ?? ''}
                onPress={() => openStep('beneficiary')}
                locked={kindLocked}
              />
            ) : null}
          </Section>
          {hasGifts ? (
            <LockNote className="mx-[22px] mt-3">
              {t('editEvent.kindLocked')}
            </LockNote>
          ) : null}

          <SectionLabel>{t('shell.people')}</SectionLabel>
          <PeopleList
            eventId={eventId}
            participants={participants}
            beneficiaryId={beneficiaryId}
          />

          <SectionLabel>{t('editEvent.inviteLink')}</SectionLabel>
          {invite ? (
            <InviteLinkRow
              eventId={eventId}
              title={event.title}
              code={invite.code}
            />
          ) : (
            <Text className="px-[22px] text-sm text-garland-ink-60">
              {t('createEvent.loading')}
            </Text>
          )}

          <DeleteEventButton eventId={eventId} title={event.title} />
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

// Everyone but the host can be removed, and the beneficiary only once the
// event is no longer for them.
function PeopleList({
  eventId,
  participants,
  beneficiaryId,
}: {
  eventId: string
  participants: ResolvedParticipant[]
  beneficiaryId: string | undefined
}) {
  const { t } = useTranslation()
  const { confirm, pending: removingId, error } = useConfirmedAction()

  const confirmRemove = ({ id, name }: ResolvedParticipant) =>
    confirm({
      key: id,
      title: t('editEvent.removeTitle', { name }),
      message: t('editEvent.removeMessage', { name }),
      action: t('editEvent.remove'),
      failed: t('editEvent.removeFailed', { name }),
      run: () => removeParticipant({ eventId, participantId: id }),
    })

  return (
    <View>
      {participants.map(p => {
        const isBeneficiary = p.id === beneficiaryId
        return (
          <View
            key={p.id}
            className="flex-row items-center gap-3.5 border-t border-garland-ink-08 px-[22px] py-3"
          >
            <ParticipantAvatar
              name={p.name}
              avatarKey={p.avatarKey}
              photo={p.photo}
              color={p.color}
              size={34}
            />
            <Text className="flex-1 text-[15px] font-semibold text-garland-ink">
              {p.name}
            </Text>
            {p.isYou ? (
              <Tag>{t('createEvent.people.host')}</Tag>
            ) : isBeneficiary ? (
              <Tag>{t('editEvent.beneficiaryTag')}</Tag>
            ) : (
              <GarlandButton
                variant="link"
                onPress={() => confirmRemove(p)}
                loading={removingId === p.id}
                disabled={removingId !== null}
                hitSlop={8}
                accessibilityLabel={t('createEvent.people.remove', {
                  name: p.name,
                })}
                className="px-0"
              >
                <GarlandButtonText className="font-semibold text-garland-berry">
                  {t('editEvent.remove')}
                </GarlandButtonText>
              </GarlandButton>
            )}
          </View>
        )
      })}
      {error ? (
        <Text className="px-[22px] pt-1 text-xs text-garland-berry">
          {error}
        </Text>
      ) : null}
    </View>
  )
}

// Set apart at the bottom of `6a`: everyone loses the event, presents and
// all, so it goes behind a confirm.
function DeleteEventButton({
  eventId,
  title,
}: {
  eventId: string
  title: string
}) {
  const { t } = useTranslation()
  const { confirm, pending, error } = useConfirmedAction()

  const confirmDelete = () =>
    confirm({
      title: t('editEvent.deleteTitle', { title }),
      message: t('editEvent.deleteMessage'),
      action: t('editEvent.delete'),
      failed: t('editEvent.deleteFailed'),
      run: async () => {
        await deleteEvent(eventId)
        router.dismissTo('/')
      },
    })

  return (
    <View className="mt-10 border-t border-garland-ink-08 px-[22px] pt-6">
      <GarlandButton
        variant="outline"
        onPress={confirmDelete}
        loading={pending !== null}
        className="border-garland-berry"
      >
        <GarlandButtonText className="text-garland-berry">
          {t('editEvent.deleteEvent')}
        </GarlandButtonText>
      </GarlandButton>
      {error ? (
        <Text className="mt-2 text-xs text-garland-berry">{error}</Text>
      ) : null}
    </View>
  )
}

function InviteLinkRow({
  eventId,
  title,
  code,
}: {
  eventId: string
  title: string
  code: string
}) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  const { confirm, pending, error } = useConfirmedAction()
  const link = inviteLink(code)

  const copy = async () => {
    await Clipboard.setStringAsync(link)
    setCopied(true)
  }

  const rotate = () =>
    confirm({
      title: t('editEvent.rotateTitle'),
      message: t('editEvent.rotateMessage'),
      action: t('editEvent.rotate'),
      failed: t('editEvent.rotateFailed'),
      run: async () => {
        await rotateInvite(eventId)
        setCopied(false)
      },
    })

  return (
    <View className="px-[22px]">
      <View className="rounded-2xl border-[1.5px] border-garland-ink-15 px-4 py-3">
        <Text
          className="text-[15px] font-semibold text-garland-ink"
          selectable
          numberOfLines={1}
        >
          {link}
        </Text>
      </View>
      <View className="mt-3 flex-row gap-3">
        <GarlandButton variant="outline" onPress={copy} className="flex-1">
          <GarlandButtonText>
            {copied ? t('editEvent.copied') : t('editEvent.copy')}
          </GarlandButtonText>
        </GarlandButton>
        <GarlandButton
          variant="outline"
          className="flex-1"
          onPress={() =>
            Share.share({ message: t('invite.shareMessage', { title, link }) })
          }
        >
          <GarlandButtonText>{t('editEvent.share')}</GarlandButtonText>
        </GarlandButton>
      </View>
      <GarlandButton
        variant="link"
        onPress={rotate}
        loading={pending !== null}
        className="mt-3 self-start px-0"
      >
        <GarlandButtonText>{t('editEvent.rotate')}</GarlandButtonText>
      </GarlandButton>
      <Text className="text-xs leading-[17px] text-garland-ink-60">
        {t('editEvent.rotateHint')}
      </Text>
      {error ? (
        <Text className="mt-2 text-xs text-garland-berry">{error}</Text>
      ) : null}
    </View>
  )
}

type ConfirmedAction = {
  // Which of several actions sharing the hook is running, e.g. a row's id.
  key?: string
  title: string
  message: string
  // The destructive button's label.
  action: string
  // Shown when `run` fails for a server reason. Any reason means the screen
  // is stale (no longer the creator, event or person gone), so one generic
  // message per action covers them all.
  failed: string
  run: () => Promise<void>
}

// `6a`'s destructive actions: each runs only after a confirm dialog, then
// reports whether it's still running and why it failed.
function useConfirmedAction() {
  const { t } = useTranslation()
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const confirm = ({
    key = '',
    title,
    message,
    action,
    failed,
    run,
  }: ConfirmedAction) =>
    Alert.alert(title, message, [
      { text: t('editEvent.cancel'), style: 'cancel' },
      {
        text: action,
        style: 'destructive',
        onPress: async () => {
          setPending(key)
          setError(null)
          try {
            await run()
          } catch (e) {
            setError(isNetworkError(e) ? t('common.networkError') : failed)
          } finally {
            setPending(null)
          }
        },
      },
    ])

  return { confirm, pending, error }
}

function Section({ children }: { children: ReactNode }) {
  return <View className="mt-5 border-b border-garland-ink-08">{children}</View>
}

function Tag({ children }: { children: string }) {
  return (
    <Text className="text-[10px] font-bold uppercase tracking-[0.8px] text-garland-green">
      {children}
    </Text>
  )
}

function SectionLabel({ children }: { children: string }) {
  return (
    <Text className="mb-1.5 mt-7 px-[22px] text-[11px] font-bold uppercase tracking-[1.1px] text-garland-ink-40">
      {children}
    </Text>
  )
}

function EditRow({
  label,
  value,
  onPress,
  locked = false,
}: {
  label: string
  value: string
  onPress: () => void
  locked?: boolean
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={locked}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      accessibilityState={{ disabled: locked }}
      className={`flex-row items-center gap-3 border-t border-garland-ink-08 px-[22px] py-3.5 active:opacity-70 ${
        locked ? 'opacity-50' : ''
      }`}
    >
      <Text className="w-24 text-[13px] text-garland-ink-60">{label}</Text>
      <Text
        className="flex-1 text-[15px] font-semibold text-garland-ink"
        numberOfLines={1}
      >
        {value}
      </Text>
      {locked ? (
        <LockIcon width={16} height={16} color={garland.ink40} />
      ) : (
        <ArrowRightIcon width={20} height={20} color={garland.ink40} />
      )}
    </Pressable>
  )
}
