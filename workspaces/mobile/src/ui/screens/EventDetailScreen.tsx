import type { GiftDoc } from '@prezentowo/types'
import { router } from 'expo-router'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, ScrollView, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { BackIcon, HamburgerIcon, PlusIcon } from '@/components/ui/icon'
import { Text } from '@/components/ui/text'
import { garland } from '@/constants/colors'
import { useEventById } from '@/hooks/useEventById'
import { useEventGifts } from '@/hooks/useEventGifts'
import { useEventParticipants } from '@/hooks/useEventParticipants'
import { EventTabs } from '@/ui/components/EventTabs'
import { type GiftClaimer, GiftRow } from '@/ui/components/GiftRow'
import { ParticipantAvatar } from '@/ui/components/ParticipantAvatar'
import { ParticipantRow } from '@/ui/components/ParticipantRow'
import { PeopleDrawer, type PersonItem } from '@/ui/components/PeopleDrawer'

type Tab = 'gifts' | 'people'

export function EventDetailScreen({ eventId }: { eventId?: string }) {
  const { t } = useTranslation()
  const event = useEventById(eventId)
  const gifts = useEventGifts(eventId)
  const { participants, resolve } = useEventParticipants(event)
  const [tab, setTab] = useState<Tab>('gifts')
  const [drawerOpen, setDrawerOpen] = useState(false)

  // userId → resolved participant, for turning a gift's claimedBy into avatars.
  const byUserId = useMemo(() => {
    const map = new Map<string, (typeof participants)[number]>()
    for (const p of participants) if (p.userId) map.set(p.userId, p)
    return map
  }, [participants])

  const claimersFor = (gift: GiftDoc): GiftClaimer[] =>
    (gift.claimedBy ?? [])
      .map(uid => byUserId.get(uid))
      .filter((p): p is NonNullable<typeof p> => !!p)
      .map(p => ({
        name: p.isYou ? t('eventDetail.you') : p.name,
        avatarKey: p.avatarKey,
      }))

  const people: PersonItem[] = useMemo(
    () =>
      participants.map(p => {
        const own = gifts.filter(g => g.forParticipantId === p.id)
        const claimed = own.filter(g => (g.claimedBy?.length ?? 0) > 0).length
        return {
          id: p.id,
          name: p.name,
          avatarKey: p.avatarKey,
          color: p.color,
          isYou: p.isYou,
          subtitle: p.isYou
            ? t('eventDetail.onYourWishlist', { count: own.length })
            : t('eventDetail.giftsClaimed', {
                count: own.length,
                claimed,
              }),
        }
      }),
    [participants, gifts, t],
  )

  if (!eventId || !event) {
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

  const openPerson = (participantId: string) => {
    setDrawerOpen(false)
    router.push(`/person?eventId=${eventId}&participantId=${participantId}`)
  }

  return (
    <SafeAreaView className="flex-1 bg-garland-paper">
      <View className="flex-1">
        <View className="flex-row items-center justify-between px-[22px] pt-3.5">
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <BackIcon width={22} height={22} color={garland.ink} />
          </Pressable>
          <Pressable onPress={() => setDrawerOpen(true)} hitSlop={12}>
            <HamburgerIcon width={22} height={22} color={garland.ink60} />
          </Pressable>
        </View>

        <View className="px-[22px] pb-5 pt-1.5">
          <Text className="mt-4 text-[11px] font-bold uppercase tracking-[1.1px] text-garland-ink-40">
            {event.date}
          </Text>
          <Text className="mb-3.5 mt-2 font-garland-display text-[34px] leading-[35px] text-garland-ink">
            {event.title}
          </Text>
          <View className="flex-row items-center justify-between">
            <View className="flex-row">
              {participants.slice(0, 5).map((p, i) => (
                <View
                  key={p.id}
                  style={{ marginLeft: i === 0 ? 0 : -10 }}
                  className="rounded-full border-2 border-garland-paper"
                >
                  <ParticipantAvatar
                    name={p.name}
                    avatarKey={p.avatarKey}
                    color={p.color}
                    size={28}
                  />
                </View>
              ))}
            </View>
            <Text className="text-[13px] text-garland-ink-60">
              {t('eventDetail.peopleGifts', {
                people: participants.length,
                gifts: gifts.length,
              })}
            </Text>
          </View>
        </View>

        <View className="flex-row gap-[18px] border-b border-garland-ink-08 px-[22px]">
          <TabButton
            label={t('eventDetail.tabGifts')}
            active={tab === 'gifts'}
            onPress={() => setTab('gifts')}
          />
          <TabButton
            label={t('eventDetail.tabPeople')}
            active={tab === 'people'}
            onPress={() => setTab('people')}
          />
        </View>

        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          {tab === 'gifts' ? (
            gifts.length === 0 ? (
              <View className="px-[22px] pt-8">
                <Text className="text-center text-sm text-garland-ink-60">
                  {t('eventDetail.noGifts')}
                </Text>
              </View>
            ) : (
              gifts.map(gift => {
                const forP = resolve(gift.forParticipantId)
                return (
                  <GiftRow
                    key={gift._id}
                    gift={gift}
                    forName={forP?.isYou ? t('eventDetail.you') : forP?.name}
                    claimers={claimersFor(gift)}
                    onPress={() =>
                      router.push(`/gift?giftId=${gift._id}&eventId=${eventId}`)
                    }
                  />
                )
              })
            )
          ) : (
            people.map(p => (
              <ParticipantRow
                key={p.id}
                name={p.name}
                avatarKey={p.avatarKey}
                color={p.color}
                subtitle={p.subtitle}
                isYou={p.isYou}
                youLabel={t('eventDetail.you')}
                onPress={() => openPerson(p.id)}
              />
            ))
          )}
          <View className="h-24" />
        </ScrollView>

        <View className="absolute bottom-[88px] right-[18px] z-10">
          <Pressable
            onPress={() => router.push(`/add-gift?eventId=${eventId}`)}
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

        <EventTabs active="home" />

        {drawerOpen ? (
          <PeopleDrawer
            eventTitle={event.title}
            people={people}
            onClose={() => setDrawerOpen(false)}
            onInvite={() => router.push(`/join-event?eventId=${eventId}`)}
            onSelectPerson={openPerson}
          />
        ) : null}
      </View>
    </SafeAreaView>
  )
}

function TabButton({
  label,
  active,
  onPress,
}: {
  label: string
  active: boolean
  onPress: () => void
}) {
  return (
    <Pressable onPress={onPress} className="active:opacity-60">
      <Text
        className={`pb-2 text-[13px] ${
          active
            ? 'border-b-2 border-garland-ink font-bold text-garland-ink'
            : 'text-garland-ink-60'
        }`}
        style={active ? { marginBottom: -1 } : undefined}
      >
        {label}
      </Text>
    </Pressable>
  )
}
