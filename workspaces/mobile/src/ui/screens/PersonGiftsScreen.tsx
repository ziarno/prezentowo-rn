import type { GiftDoc } from '@prezentowo/types'
import { router } from 'expo-router'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, ScrollView, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { BackIcon, BellIcon, LockIcon, PlusIcon } from '@/components/ui/icon'
import { Text } from '@/components/ui/text'
import { garland } from '@/constants/colors'
import { useEventById } from '@/hooks/useEventById'
import { useEventGifts } from '@/hooks/useEventGifts'
import { useEventParticipants } from '@/hooks/useEventParticipants'
import { type GiftClaimer, GiftRow } from '@/ui/components/GiftRow'
import { ParticipantAvatar } from '@/ui/components/ParticipantAvatar'

export function PersonGiftsScreen({
  eventId,
  participantId,
}: {
  eventId?: string
  participantId?: string
}) {
  const { t } = useTranslation()
  const event = useEventById(eventId)
  const gifts = useEventGifts(eventId)
  const { participants, resolve } = useEventParticipants(event)

  const person = participantId ? resolve(participantId) : undefined
  const isYou = person?.isYou ?? false

  const byUserId = useMemo(() => {
    const map = new Map<string, (typeof participants)[number]>()
    for (const p of participants) if (p.userId) map.set(p.userId, p)
    return map
  }, [participants])

  const personGifts = gifts.filter(g => g.forParticipantId === participantId)
  const claimedCount = personGifts.filter(
    g => (g.claimedBy?.length ?? 0) > 0,
  ).length

  const claimersFor = (gift: GiftDoc): GiftClaimer[] =>
    (gift.claimedBy ?? [])
      .map(uid => byUserId.get(uid))
      .filter((p): p is NonNullable<typeof p> => !!p)
      .map(p => ({
        name: p.isYou ? t('eventDetail.you') : p.name,
        avatarKey: p.avatarKey,
      }))

  if (!event || !person) {
    return (
      <SafeAreaView className="flex-1 bg-garland-paper">
        <View className="flex-row px-[22px] pt-3.5">
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <BackIcon width={22} height={22} color={garland.ink} />
          </Pressable>
        </View>
        <View className="flex-1 items-center justify-center px-7">
          <Text className="text-center text-sm text-garland-ink-60">
            {t('join.loadingEvent')}
          </Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-garland-paper">
      <View className="flex-1">
        <View className="flex-row items-center justify-between px-[22px] pt-3.5">
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <BackIcon width={22} height={22} color={garland.ink} />
          </Pressable>
          <Pressable hitSlop={8}>
            <BellIcon width={22} height={22} color={garland.ink60} />
            <View className="absolute -right-0.5 -top-0.5 size-2 rounded-full border-[1.5px] border-garland-paper bg-garland-berry" />
          </Pressable>
        </View>

        <View className="flex-row items-center gap-4 px-[22px] pb-4 pt-3.5">
          <ParticipantAvatar
            name={person.name}
            avatarKey={person.avatarKey}
            color={person.color}
            size={64}
          />
          <View className="min-w-0 flex-1">
            <Text className="text-[11px] font-bold uppercase tracking-[1.1px] text-garland-ink-40">
              {isYou
                ? t('person.yourWishlist')
                : t('person.theirWishlist', { name: person.name })}
            </Text>
            <Text className="mt-1 font-garland-display text-[26px] leading-[27px] text-garland-ink">
              {isYou ? t('eventDetail.you') : person.name}
            </Text>
            <Text className="mt-1 text-xs text-garland-ink-60">
              {t('person.giftsClaimed', {
                count: personGifts.length,
                claimed: claimedCount,
              })}
            </Text>
          </View>
        </View>

        {!isYou ? (
          <View className="mx-[22px] mb-3 flex-row items-center gap-2.5 rounded-xl bg-garland-paper2 px-3.5 py-2.5">
            <LockIcon width={14} height={14} color={garland.green} />
            <Text className="flex-1 text-xs leading-[17px] text-garland-ink-60">
              {t('person.secretHint', { name: person.name })}
            </Text>
          </View>
        ) : null}

        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          {personGifts.length === 0 ? (
            <View className="px-[22px] pt-6">
              <Text className="text-center text-sm text-garland-ink-60">
                {isYou ? t('person.emptyYours') : t('person.empty')}
              </Text>
            </View>
          ) : (
            personGifts.map(gift => (
              <GiftRow
                key={gift._id}
                gift={gift}
                showDescription
                claimers={isYou ? [] : claimersFor(gift)}
                topBorder
                onPress={() =>
                  router.push(`/gift?giftId=${gift._id}&eventId=${eventId}`)
                }
              />
            ))
          )}
          <View className="h-24" />
        </ScrollView>

        {isYou ? (
          <View className="absolute bottom-9 right-[18px]">
            <Pressable
              onPress={() =>
                router.push(
                  `/add-gift?eventId=${eventId}&forParticipantId=${participantId}`,
                )
              }
              className="size-14 items-center justify-center rounded-full bg-garland-ink active:opacity-80"
              style={{
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: 0.4,
                shadowRadius: 12,
                elevation: 8,
              }}
            >
              <PlusIcon width={22} height={22} color={garland.paper} />
            </Pressable>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  )
}
