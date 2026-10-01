import * as Clipboard from 'expo-clipboard'
import { router } from 'expo-router'
import { type ReactNode, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, Pressable, ScrollView, Share, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import type { WizardStep } from '@/api/eventWizard'
import { beneficiaryIdOf } from '@/api/events'
import { inviteLink, rotateInvite } from '@/api/invites'
import { ArrowRightIcon, LockIcon } from '@/components/ui/icon'
import { Text } from '@/components/ui/text'
import { garland } from '@/constants/colors'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useEventById } from '@/hooks/useEventById'
import { useEventGifts } from '@/hooks/useEventGifts'
import { useEventInvite } from '@/hooks/useEventInvite'
import { useEventParticipants } from '@/hooks/useEventParticipants'
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
  const { t } = useTranslation()
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
            value={event.date}
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
        <View>
          {participants.map(p => (
            <View
              key={p.id}
              className="flex-row items-center gap-3.5 border-t border-garland-ink-08 px-[22px] py-3"
            >
              <ParticipantAvatar
                name={p.name}
                avatarKey={p.avatarKey}
                color={p.color}
                size={34}
              />
              <Text className="flex-1 text-[15px] font-semibold text-garland-ink">
                {p.name}
              </Text>
              {p.isYou ? (
                <Text className="text-[10px] font-bold uppercase tracking-[0.8px] text-garland-green">
                  {t('createEvent.people.host')}
                </Text>
              ) : null}
            </View>
          ))}
        </View>

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
      </ScrollView>
    </SafeAreaView>
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
  const [rotating, setRotating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const link = inviteLink(code)

  const copy = async () => {
    await Clipboard.setStringAsync(link)
    setCopied(true)
  }

  const rotate = () =>
    Alert.alert(t('editEvent.rotateTitle'), t('editEvent.rotateMessage'), [
      { text: t('editEvent.cancel'), style: 'cancel' },
      {
        text: t('editEvent.rotate'),
        style: 'destructive',
        onPress: async () => {
          setRotating(true)
          setError(null)
          try {
            await rotateInvite(eventId)
            setCopied(false)
          } catch (e) {
            // Any other server reason means the screen is stale (no longer
            // the creator, event gone): the generic message covers it.
            setError(
              isNetworkError(e)
                ? t('common.networkError')
                : t('editEvent.rotateFailed'),
            )
          } finally {
            setRotating(false)
          }
        },
      },
    ])

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
        loading={rotating}
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

function Section({ children }: { children: ReactNode }) {
  return <View className="mt-5 border-b border-garland-ink-08">{children}</View>
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
