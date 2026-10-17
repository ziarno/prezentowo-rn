import type { EventDoc } from '@prezentowo/types'
import { router } from 'expo-router'
import {
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
} from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, View, useWindowDimensions } from 'react-native'
import Animated, {
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { scheduleOnRN } from 'react-native-worklets'

import { recipientOptions } from '@/api/giftWizard'
import type { ResolvedParticipant } from '@/api/participants'
import {
  type ShownGift,
  giftWrite,
  shownBuyers,
  withQueuedGifts,
} from '@/api/pendingWrites'
import { peopleInOrder, personPresents } from '@/api/presentLists'
import { PlusIcon } from '@/components/ui/icon'
import { Text } from '@/components/ui/text'
import { garland } from '@/constants/colors'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useEventById } from '@/hooks/useEventById'
import { useEventGifts } from '@/hooks/useEventGifts'
import { useEventParticipants } from '@/hooks/useEventParticipants'
import { useQueuedWrites } from '@/hooks/useQueuedWrites'
import { discardWrite } from '@/sync'
import {
  COVER_GUTTER,
  EventCover,
  coverHeightAt,
  useCoverScroll,
} from '@/ui/components/EventCover'
import { GiftTag, type GiftTone, TONE_COLOR } from '@/ui/components/GiftTag'
import { ParticipantAvatar } from '@/ui/components/ParticipantAvatar'
import { ScreenHeader } from '@/ui/components/ScreenHeader'

// The params that open this section scrolled to `participantId`. `jump` is
// new every time, so asking for the person already on screen scrolls back
// to them too.
export const personSectionParams = (
  eventId: string,
  participantId: string,
) => ({
  eventId,
  participantId,
  jump: String(Date.now()),
})

// Everyone's presents, one list after another in the drawer's order, under
// the event's cover: `3e` for the viewer's own list, `3f` for anyone else's.
// A person's avatar and name stick under the cover until the next person's
// push them off. It opens scrolled to `participantId`, and keeps that param
// on whoever's stuck there, so the drawer marks them and ＋ adds for them.
// Their own wishes are green, others' suggestions berry. Writes still in the
// offline queue show in place (docs/spec.md §6.4): a queued present in its
// group, a queued claim on its present.
export function PersonPresentsScreen({
  eventId,
  participantId,
  jump,
}: {
  eventId: string
  participantId: string
  jump?: string
}) {
  const { t } = useTranslation()
  const { event, ready } = useEventById(eventId)
  const scrollRef = useRef<Animated.ScrollView>(null)

  if (!event) {
    return (
      <SafeAreaView className="flex-1 bg-garland-paper">
        <ScreenHeader title="" />
        <View className="flex-1 items-center justify-center px-7">
          <Text className="text-center text-sm text-garland-ink-60">
            {ready ? t('person.notFound') : t('person.loading')}
          </Text>
        </View>
      </SafeAreaView>
    )
  }

  // Only someone who gets presents in this event has a list to add to.
  // Adding works offline too: it's queued.
  const options = recipientOptions(event)

  return (
    <View className="flex-1">
      <EventCover event={event} scrollRef={scrollRef}>
        <PresentLists
          event={event}
          participantId={participantId}
          jump={jump}
          scrollRef={scrollRef}
          withAdd={options.length > 0}
        />
      </EventCover>
      {options.length > 0 ? (
        <View
          className="absolute bottom-10 left-0 right-0 items-center"
          pointerEvents="box-none"
        >
          <Pressable
            onPress={() =>
              router.push({
                pathname: '/event/[eventId]/add-gift',
                params: options.includes(participantId)
                  ? { eventId, forParticipantId: participantId }
                  : { eventId },
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
    </View>
  )
}

function PresentLists({
  event,
  participantId,
  jump,
  scrollRef,
  withAdd,
}: {
  event: EventDoc
  participantId: string
  jump?: string
  scrollRef: RefObject<Animated.ScrollView | null>
  withAdd: boolean
}) {
  const { scrollY, expanded, collapsed } = useCoverScroll()
  const insets = useSafeAreaInsets()
  const { height: windowHeight } = useWindowDimensions()
  const { participants } = useEventParticipants(event._id)
  const people = peopleInOrder(event, participants).filter(p => p.hasList)

  // Where each person's list starts in the scroll content, in order.
  const tops = useRef(new Map<string, number>())
  const sharedTops = useSharedValue<{ id: string; y: number }[]>([])

  const stuck = useRef<string | undefined>(undefined)
  const pending = useRef<{ id: string; animated: boolean } | null>(null)
  const lastJump = useRef<string | undefined>(undefined)

  // Scrolls to the asked-for person once their list has laid out, so it
  // starts right under the collapsed cover.
  const flush = useCallback(() => {
    const target = pending.current
    const y = target ? tops.current.get(target.id) : undefined
    if (!target || y === undefined) return
    pending.current = null
    scrollRef.current?.scrollTo({ y: y - collapsed, animated: target.animated })
  }, [collapsed, scrollRef])

  // A new jump, or a person asked for from elsewhere (a notification); not
  // the param following whoever's stuck under the cover.
  useEffect(() => {
    if (jump === lastJump.current && participantId === stuck.current) return
    const first = lastJump.current === undefined && stuck.current === undefined
    lastJump.current = jump
    pending.current = { id: participantId, animated: !first }
    flush()
  }, [jump, participantId, flush])

  const onSectionLayout = (id: string, y: number) => {
    tops.current.set(id, y)
    sharedTops.set(
      people.flatMap(({ id: pid }) => {
        const top = tops.current.get(pid)
        return top === undefined ? [] : [{ id: pid, y: top }]
      }),
    )
    flush()
  }

  const onStuck = useCallback((id: string) => {
    stuck.current = id
    router.setParams({ participantId: id })
  }, [])

  // Whoever's stuck under the cover: the last person whose list has
  // reached it, or the first before anyone's has.
  useAnimatedReaction(
    () => {
      const list = sharedTops.get()
      if (list.length === 0) return undefined
      const cover = coverHeightAt(scrollY.get(), { expanded, collapsed })
      let id = list[0].id
      for (const top of list)
        if (top.y - scrollY.get() <= cover + 1) id = top.id
      return id
    },
    (id, previous) => {
      if (id !== undefined && id !== previous) scheduleOnRN(onStuck, id)
    },
  )

  // However short the last list, it can scroll up to the cover.
  const lastMinHeight = windowHeight - collapsed - (insets.bottom + 24)

  return (
    <>
      {people.map((person, i) => (
        <PersonSection
          key={person.id}
          event={event}
          person={person}
          onLayout={y => onSectionLayout(person.id, y)}
          minHeight={i === people.length - 1 ? lastMinHeight : undefined}
          bottomPadding={i === people.length - 1 && withAdd ? 88 : 24}
        />
      ))}
    </>
  )
}

// One person's list, with their avatar and name stuck under the cover while
// any of it is on screen. The rows are full-bleed, as on a screen of their
// own.
function PersonSection({
  event,
  person,
  onLayout,
  minHeight,
  bottomPadding,
}: {
  event: EventDoc
  person: ResolvedParticipant
  onLayout: (y: number) => void
  minHeight?: number
  bottomPadding: number
}) {
  const { scrollY, expanded, collapsed } = useCoverScroll()
  const top = useSharedValue(0)
  const height = useSharedValue(0)
  const headerHeight = useSharedValue(0)

  const headerStyle = useAnimatedStyle(() => {
    const cover = coverHeightAt(scrollY.get(), { expanded, collapsed })
    const under = cover - (top.get() - scrollY.get())
    const max = Math.max(height.get() - headerHeight.get(), 0)
    return {
      transform: [{ translateY: Math.min(Math.max(under, 0), max) }],
    }
  })

  return (
    <View
      style={{
        marginHorizontal: -COVER_GUTTER,
        minHeight,
        paddingBottom: bottomPadding,
      }}
      onLayout={e => {
        top.set(e.nativeEvent.layout.y)
        height.set(e.nativeEvent.layout.height)
        onLayout(e.nativeEvent.layout.y)
      }}
    >
      <Animated.View
        style={[{ zIndex: 1 }, headerStyle]}
        onLayout={e => headerHeight.set(e.nativeEvent.layout.height)}
        className="flex-row items-center gap-3 border-b border-garland-ink-08 bg-garland-paper px-[22px] py-3"
      >
        <ParticipantAvatar
          name={person.name}
          avatarKey={person.avatarKey}
          photo={person.photo}
          color={person.color}
          size={32}
        />
        <Text
          className="flex-1 font-garland-display text-lg text-garland-ink"
          numberOfLines={1}
          accessibilityRole="header"
        >
          {person.name}
        </Text>
      </Animated.View>
      <PersonPresents event={event} person={person} />
    </View>
  )
}

function PersonPresents({
  event,
  person,
}: {
  event: EventDoc
  person: ResolvedParticipant
}) {
  const { t } = useTranslation()
  const user = useCurrentUser()
  const { gifts: serverGifts } = useEventGifts(event._id)
  const writes = useQueuedWrites()
  const { resolveUser } = useEventParticipants(event._id)

  const gifts = withQueuedGifts(serverGifts, writes, event._id, user?._id)
  const list = personPresents(event, person.id, gifts, user?._id)

  const openGift = (gift: ShownGift) =>
    router.push({
      pathname: '/event/[eventId]/gift/[giftId]',
      params: { eventId: event._id, giftId: gift._id },
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
          viewer={user ? resolveUser(user._id) : undefined}
          write={write}
          onDiscard={write ? () => discardWrite(write.id) : undefined}
          onPress={() => openGift(gift)}
        />
      )
    })

  if (list.kind === 'mine') {
    return (
      <>
        <View className="px-[22px] pb-4 pt-4">
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
    )
  }

  return (
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
            <Empty>{t('person.emptyOwnWishes', { name: person.name })}</Empty>
          )}
        </>
      )}
      <SectionTitle tone="suggested">{t('person.suggested')}</SectionTitle>
      {list.suggested.length > 0 ? (
        tags(list.suggested, 'suggested', true)
      ) : (
        <Empty>{t('person.emptySuggested')}</Empty>
      )}
    </>
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
