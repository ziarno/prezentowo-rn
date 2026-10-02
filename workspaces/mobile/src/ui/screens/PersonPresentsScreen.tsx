import type { GiftDoc } from '@prezentowo/types'
import { router } from 'expo-router'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, ScrollView, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { recipientOptions } from '@/api/giftWizard'
import { personPresents } from '@/api/presentLists'
import { PlusIcon } from '@/components/ui/icon'
import { Text } from '@/components/ui/text'
import { garland } from '@/constants/colors'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useEventById } from '@/hooks/useEventById'
import { useEventGifts } from '@/hooks/useEventGifts'
import { useEventParticipants } from '@/hooks/useEventParticipants'
import { useOffline } from '@/hooks/useOffline'
import { usePersonName } from '@/hooks/usePersonName'
import { GiftRow } from '@/ui/components/GiftRow'
import { LockNote } from '@/ui/components/LockNote'
import { ParticipantAvatar } from '@/ui/components/ParticipantAvatar'
import { ScreenHeader } from '@/ui/components/ScreenHeader'

// A person's presents: `3e` for the viewer's own list, `3f` for anyone else's.
export function PersonPresentsScreen({
  eventId,
  participantId,
}: {
  eventId: string
  participantId: string
}) {
  const { t } = useTranslation()
  const offline = useOffline()
  const user = useCurrentUser()
  const { event, ready: eventReady } = useEventById(eventId)
  const { gifts, ready: giftsReady } = useEventGifts(eventId)
  const { resolve, resolveUser } = useEventParticipants(eventId)
  const nameOf = usePersonName()

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

  const list = personPresents(event, participantId, gifts, user?._id)

  const buyersOf = (gift: GiftDoc) =>
    (gift.claimedBy ?? []).map(userId => nameOf(resolveUser(userId)))

  const openGift = (gift: GiftDoc) =>
    router.push({
      pathname: '/event/[eventId]/gift/[giftId]',
      params: { eventId, giftId: gift._id },
    })

  const rows = (items: GiftDoc[], withBuyers: boolean) =>
    items.map(gift => (
      <GiftRow
        key={gift._id}
        gift={gift}
        showDescription
        buyers={withBuyers ? buyersOf(gift) : undefined}
        topBorder
        onPress={() => openGift(gift)}
      />
    ))

  const giftCount =
    list.kind === 'mine'
      ? list.gifts.length
      : list.ownWishes.length + list.suggested.length
  const withBuyerCount =
    list.kind === 'mine'
      ? 0
      : [...list.ownWishes, ...list.suggested].filter(
          g => (g.claimedBy?.length ?? 0) > 0,
        ).length

  // Only someone who gets presents in this event has a list to add to.
  const addPresent = recipientOptions(event).includes(participantId) ? (
    <Pressable
      onPress={() =>
        router.push({
          pathname: '/event/[eventId]/add-gift',
          params: { eventId, forParticipantId: participantId },
        })
      }
      disabled={offline}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel={t('shell.addPresent')}
      accessibilityState={{ disabled: offline }}
      className={offline ? 'opacity-40' : undefined}
    >
      <PlusIcon width={22} height={22} color={garland.ink} />
    </Pressable>
  ) : undefined

  return (
    <SafeAreaView className="flex-1 bg-garland-paper">
      <ScreenHeader title={event.title} right={addPresent} />
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        <View className="flex-row items-center gap-4 px-[22px] pb-4 pt-2">
          <ParticipantAvatar
            name={person.name}
            avatarKey={person.avatarKey}
            color={person.color}
            size={64}
          />
          <View className="min-w-0 flex-1">
            <Text className="text-[11px] font-bold uppercase tracking-[1.1px] text-garland-ink-40">
              {list.kind === 'mine'
                ? t('person.yourList')
                : t('person.theirList', { name: person.name })}
            </Text>
            <Text
              className="mt-1 font-garland-display text-[26px] leading-[30px] text-garland-ink"
              numberOfLines={1}
            >
              {person.name}
            </Text>
            <Text className="mt-1 text-xs text-garland-ink-60">
              {list.kind === 'mine'
                ? t('person.presentCount', { count: giftCount })
                : t('person.presentsWithBuyer', {
                    count: giftCount,
                    withBuyer: withBuyerCount,
                  })}
            </Text>
          </View>
        </View>

        {list.kind === 'mine' ? (
          <>
            <LockNote className="mx-[22px] mb-3">
              {t('person.ownListNote')}
            </LockNote>
            {list.gifts.length > 0 ? (
              rows(list.gifts, false)
            ) : (
              <Empty>{t('person.emptyMine')}</Empty>
            )}
          </>
        ) : (
          <>
            {/* A placeholder can't add presents, so has no wishes group. */}
            {person.isPlaceholder ? null : (
              <>
                <SectionTitle>
                  {t('person.ownWishes', { name: person.name })}
                </SectionTitle>
                {list.ownWishes.length > 0 ? (
                  rows(list.ownWishes, true)
                ) : (
                  <Empty>
                    {t('person.emptyOwnWishes', { name: person.name })}
                  </Empty>
                )}
              </>
            )}
            <SectionTitle>{t('person.suggested')}</SectionTitle>
            {person.isPlaceholder ? null : (
              <LockNote className="mx-[22px] mb-3">
                {t('person.suggestedNote', { name: person.name })}
              </LockNote>
            )}
            {list.suggested.length > 0 ? (
              rows(list.suggested, true)
            ) : (
              <Empty>{t('person.emptySuggested')}</Empty>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <Text className="mb-2 mt-6 px-[22px] text-[11px] font-bold uppercase tracking-[1.1px] text-garland-ink-40">
      {children}
    </Text>
  )
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <Text className="border-t border-garland-ink-08 px-[22px] py-4 text-sm text-garland-ink-60">
      {children}
    </Text>
  )
}
