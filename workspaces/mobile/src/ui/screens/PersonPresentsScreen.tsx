import { router } from 'expo-router'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, ScrollView, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { recipientOptions } from '@/api/giftWizard'
import {
  type ShownGift,
  giftWrite,
  shownBuyers,
  withQueuedGifts,
} from '@/api/pendingWrites'
import { personPresents } from '@/api/presentLists'
import { PlusIcon } from '@/components/ui/icon'
import { Text } from '@/components/ui/text'
import { garland } from '@/constants/colors'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useEventById } from '@/hooks/useEventById'
import { useEventGifts } from '@/hooks/useEventGifts'
import { useEventParticipants } from '@/hooks/useEventParticipants'
import { useQueuedWrites } from '@/hooks/useQueuedWrites'
import { discardWrite } from '@/sync'
import { GiftTag, type GiftTone, TONE_COLOR } from '@/ui/components/GiftTag'
import { ParticipantAvatar } from '@/ui/components/ParticipantAvatar'
import { ScreenHeader } from '@/ui/components/ScreenHeader'

// A person's presents: `3e` for the viewer's own list, `3f` for anyone else's.
// Their own wishes are green, others' suggestions berry. Writes still in the
// offline queue show in place (docs/spec.md §6.4): a queued present in its
// group, a queued claim on its present.
export function PersonPresentsScreen({
  eventId,
  participantId,
}: {
  eventId: string
  participantId: string
}) {
  const { t } = useTranslation()
  const user = useCurrentUser()
  const { event, ready: eventReady } = useEventById(eventId)
  const { gifts: serverGifts, ready: giftsReady } = useEventGifts(eventId)
  const writes = useQueuedWrites()
  const { resolve, resolveUser } = useEventParticipants(eventId)

  const person = resolve(participantId)
  const ready = eventReady && giftsReady

  if (!event || !person) {
    return (
      <SafeAreaView className="flex-1 bg-garland-paper">
        <ScreenHeader title={event?.title ?? ''} />
        <View className="flex-1 items-center justify-center px-7">
          <Text className="text-center text-sm text-garland-ink-60">
            {ready ? t('person.notFound') : t('person.loading')}
          </Text>
        </View>
      </SafeAreaView>
    )
  }

  const gifts = withQueuedGifts(serverGifts, writes, eventId, user?._id)
  const list = personPresents(event, participantId, gifts, user?._id)

  const openGift = (gift: ShownGift) =>
    router.push({
      pathname: '/event/[eventId]/gift/[giftId]',
      params: { eventId, giftId: gift._id },
    })

  const tags = (items: ShownGift[], tone: GiftTone, withBuyers: boolean) =>
    items.map(gift => {
      const write = giftWrite(writes, gift._id)
      return (
        <GiftTag
          key={gift._id}
          gift={gift}
          tone={tone}
          buyers={
            withBuyers
              ? shownBuyers(gift, write, user?._id).map(resolveUser)
              : undefined
          }
          suggestedBy={
            tone === 'suggested' ? resolveUser(gift.createdBy) : undefined
          }
          write={write}
          onDiscard={write ? () => discardWrite(write.id) : undefined}
          onPress={() => openGift(gift)}
        />
      )
    })

  // Only someone who gets presents in this event has a list to add to.
  // Adding works offline too: it's queued.
  const canAdd = recipientOptions(event).includes(participantId)

  return (
    <SafeAreaView className="flex-1 bg-garland-paper">
      <ScreenHeader
        title={person.name}
        leading={
          <ParticipantAvatar
            name={person.name}
            avatarKey={person.avatarKey}
            photo={person.photo}
            color={person.color}
            size={32}
          />
        }
      />
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: canAdd ? 112 : 32 }}
      >
        {list.kind === 'mine' ? (
          <>
            <View className="px-[22px] pb-4 pt-2">
              <Text className="text-[11px] font-bold uppercase tracking-[1.1px] text-garland-ink-40">
                {t('person.yourList')}
              </Text>
              <Text className="mt-1 text-xs text-garland-ink-60">
                {t('person.presentCount', { count: list.gifts.length })}
              </Text>
            </View>
            {list.gifts.length > 0 ? (
              tags(list.gifts, 'own', false)
            ) : (
              <Empty>{t('person.emptyMine')}</Empty>
            )}
          </>
        ) : (
          <>
            {/* A placeholder can't add presents, so has no wishes group. */}
            {person.isPlaceholder ? null : (
              <>
                <SectionTitle tone="own">
                  {t('person.ownWishes', { name: person.name })}
                </SectionTitle>
                {list.ownWishes.length > 0 ? (
                  tags(list.ownWishes, 'own', true)
                ) : (
                  <Empty>
                    {t('person.emptyOwnWishes', { name: person.name })}
                  </Empty>
                )}
              </>
            )}
            <SectionTitle tone="suggested">
              {t('person.suggested')}
            </SectionTitle>
            {list.suggested.length > 0 ? (
              tags(list.suggested, 'suggested', true)
            ) : (
              <Empty>{t('person.emptySuggested')}</Empty>
            )}
          </>
        )}
      </ScrollView>
      {canAdd ? (
        <View
          className="absolute bottom-10 left-0 right-0 items-center"
          pointerEvents="box-none"
        >
          <Pressable
            onPress={() =>
              router.push({
                pathname: '/event/[eventId]/add-gift',
                params: { eventId, forParticipantId: participantId },
              })
            }
            accessibilityRole="button"
            accessibilityLabel={t('shell.addPresent')}
            className="h-14 w-14 items-center justify-center rounded-full bg-garland-ink shadow-md active:opacity-70"
          >
            <PlusIcon width={24} height={24} color={garland.paper} />
          </Pressable>
        </View>
      ) : null}
    </SafeAreaView>
  )
}

function SectionTitle({
  tone,
  children,
}: {
  tone: GiftTone
  children: ReactNode
}) {
  return (
    <View className="mb-2.5 mt-5 flex-row items-center gap-2 px-[22px]">
      <View
        className="h-2 w-2 rounded-full"
        style={{ backgroundColor: TONE_COLOR[tone] }}
      />
      <Text
        className="flex-1 text-[11px] font-bold uppercase tracking-[1.1px]"
        style={{ color: TONE_COLOR[tone] }}
      >
        {children}
      </Text>
    </View>
  )
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <Text className="px-[22px] pb-2 text-sm text-garland-ink-60">
      {children}
    </Text>
  )
}
