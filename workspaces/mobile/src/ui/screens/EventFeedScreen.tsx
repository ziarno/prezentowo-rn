import type { EventDoc } from '@prezentowo/types'
import { router, useFocusEffect, useNavigation } from 'expo-router'
import { DrawerActions } from 'expo-router/react-navigation'
import { setStatusBarStyle } from 'expo-status-bar'
import { type ReactNode, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native'
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'

import { activityLines, buyerSummary } from '@/api/activityFeed'
import { type CoverTone, coverTone } from '@/api/stockArt'
import { BackIcon, HamburgerIcon } from '@/components/ui/icon'
import { Text } from '@/components/ui/text'
import { garland } from '@/constants/colors'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useEventActivity } from '@/hooks/useEventActivity'
import { useEventById } from '@/hooks/useEventById'
import { useEventGifts } from '@/hooks/useEventGifts'
import { useEventParticipants } from '@/hooks/useEventParticipants'
import { useHasScreenBeneath } from '@/hooks/useHasScreenBeneath'
import { eventWhen } from '@/localization/eventDates'
import { ActivityFeedItem } from '@/ui/components/ActivityFeedItem'
import { EventBackground } from '@/ui/components/EventBackground'
import { ScreenHeader } from '@/ui/components/ScreenHeader'

// The cover below the status bar: `3c` fully open, `3c3` collapsed to the
// bar holding ☰.
const COVER_HEIGHT = 280
const BAR_HEIGHT = 56

// `3c`–`3c4`: the event's cover over its feed. The cover is an absolutely
// positioned header that collapses from `3c` to the compact `3c3` as the feed
// scrolls, and stays that size.
export function EventFeedScreen({ eventId }: { eventId: string }) {
  const { t } = useTranslation()
  const { event, ready } = useEventById(eventId)

  if (!event) {
    return (
      <SafeAreaView className="flex-1 bg-garland-paper">
        <ScreenHeader title={t('shell.activity')} />
        <View className="flex-1 items-center justify-center px-7">
          <Text className="text-center text-sm text-garland-ink-60">
            {ready ? t('feed.notFound') : t('feed.loading')}
          </Text>
        </View>
      </SafeAreaView>
    )
  }

  const tone = coverTone(event.background, event._id)
  return (
    <CollapsingCover
      event={event}
      tone={tone}
      cover={<CoverDetails eventId={eventId} date={event.date} tone={tone} />}
    >
      <ActivityList event={event} />
    </CollapsingCover>
  )
}

// The feed: how many presents have a buyer, then every activity item the
// viewer may see, newest first.
function ActivityList({ event }: { event: EventDoc }) {
  const { t } = useTranslation()
  const user = useCurrentUser()
  const { items, ready } = useEventActivity(event._id)
  const { gifts } = useEventGifts(event._id)
  const { resolve } = useEventParticipants(event._id)
  const now = new Date()

  const lines = activityLines(event, items, user?._id)
  const buyers = buyerSummary(event, gifts, user?._id)

  const openGift = (giftId: string) =>
    router.push({
      pathname: '/event/[eventId]/gift/[giftId]',
      params: { eventId: event._id, giftId },
    })
  const openPerson = (participantId: string) =>
    router.push({
      pathname: '/event/[eventId]/person/[participantId]',
      params: { eventId: event._id, participantId },
    })

  return (
    <View className="gap-2.5 pt-5">
      {buyers.total > 0 ? (
        <View className="rounded-2xl bg-garland-paper2 px-3.5 py-3">
          <Text className="text-sm font-semibold text-garland-ink">
            {t('feed.withBuyer', {
              count: buyers.total,
              withBuyer: buyers.withBuyer,
            })}
          </Text>
        </View>
      ) : null}

      <Text className="mt-1 text-[11px] font-bold uppercase tracking-[1.1px] text-garland-ink-40">
        {t('shell.activity')}
      </Text>

      {lines.length === 0 ? (
        <Text className="py-6 text-center text-sm text-garland-ink-60">
          {ready ? t('feed.empty') : t('feed.loading')}
        </Text>
      ) : (
        lines.map(({ item, line }) => {
          const gift =
            'giftId' in line
              ? gifts.find(g => g._id === line.giftId)
              : undefined
          const actor = resolve(line.actorId)
          return (
            <ActivityFeedItem
              key={item._id}
              line={line}
              createdAt={item.createdAt}
              now={now}
              actor={actor}
              recipient={
                'recipientId' in line && line.recipientId
                  ? resolve(line.recipientId)
                  : undefined
              }
              gift={gift}
              // A present opens while it's still there; a join opens the
              // person's list while they're still in the event.
              onPress={
                gift
                  ? () => openGift(gift._id)
                  : line.kind === 'joined' && actor
                    ? () => openPerson(actor.id)
                    : undefined
              }
            />
          )
        })
      )}
    </View>
  )
}

// Cover text sits straight on a stock pattern, in ink or paper to match its
// tone; a photo gets a scrim and paper text.
const coverTextColor = (tone: CoverTone) =>
  tone === 'light' ? 'text-garland-ink' : 'text-garland-paper'

function CollapsingCover({
  event,
  tone,
  cover,
  children,
}: {
  event: EventDoc
  tone: CoverTone
  // The `3c` details under the title; they fade as the cover collapses.
  cover: ReactNode
  children: ReactNode
}) {
  const insets = useSafeAreaInsets()
  const { height: windowHeight } = useWindowDimensions()
  const scrollY = useSharedValue(0)
  const textColor = coverTextColor(tone)

  const expanded = insets.top + COVER_HEIGHT
  const collapsed = insets.top + BAR_HEIGHT
  const range = expanded - collapsed

  // The status bar matches the cover text; screens above it are paper.
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle(tone === 'light' ? 'dark' : 'light')
      return () => setStatusBarStyle('dark')
    }, [tone]),
  )

  const onScroll = useAnimatedScrollHandler(e => {
    scrollY.set(e.contentOffset.y)
  })

  const coverStyle = useAnimatedStyle(() => ({
    height: interpolate(
      scrollY.get(),
      [0, range],
      [expanded, collapsed],
      Extrapolation.CLAMP,
    ),
  }))
  const detailsStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollY.get(),
      [0, range * 0.6],
      [1, 0],
      Extrapolation.CLAMP,
    ),
  }))
  const barTitleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollY.get(),
      [range * 0.6, range],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  }))

  return (
    <View className="flex-1 bg-garland-paper">
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: expanded,
          paddingHorizontal: 22,
          paddingBottom: insets.bottom + 24,
          // However short the feed, it can scroll far enough to collapse.
          minHeight: windowHeight + range,
        }}
      >
        {children}
      </Animated.ScrollView>

      <Animated.View
        style={[styles.cover, coverStyle]}
        pointerEvents="box-none"
      >
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <EventBackground event={event} height="100%" derivative={1600} />
          {tone === 'photo' ? (
            <View style={[StyleSheet.absoluteFill, styles.scrim]} />
          ) : null}
        </View>

        <View
          className="flex-row items-center gap-2.5 px-4"
          style={{ marginTop: insets.top, height: BAR_HEIGHT }}
        >
          <CoverButtons />
          {/* Faded in as the `3c` title fades out; iOS leaves whichever is
              transparent out of the accessibility tree. */}
          <Animated.View style={[styles.barTitle, barTitleStyle]}>
            <Text
              className={`font-garland-display text-lg ${textColor}`}
              numberOfLines={1}
            >
              {event.title}
            </Text>
          </Animated.View>
        </View>

        <Animated.View
          style={[styles.details, detailsStyle]}
          pointerEvents="none"
        >
          <Text
            className={`font-garland-display text-[34px] leading-[38px] ${textColor}`}
            numberOfLines={2}
            accessibilityRole="header"
          >
            {event.title}
          </Text>
          {cover}
        </Animated.View>
      </Animated.View>
    </View>
  )
}

// ☰ on a paper chip, with ← beside it when something is underneath.
function CoverButtons() {
  const { t } = useTranslation()
  const navigation = useNavigation()
  const hasScreenBeneath = useHasScreenBeneath()

  return (
    <>
      {hasScreenBeneath ? (
        <Chip onPress={() => router.back()} label={t('shell.back')}>
          <BackIcon width={20} height={20} color={garland.ink} />
        </Chip>
      ) : null}
      <Chip
        onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
        label={t('shell.openMenu')}
      >
        <HamburgerIcon width={20} height={20} color={garland.ink} />
      </Chip>
    </>
  )
}

function Chip({
  onPress,
  label,
  children,
}: {
  onPress: () => void
  label: string
  children: ReactNode
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="size-9 items-center justify-center rounded-full bg-garland-paper active:opacity-70"
    >
      {children}
    </Pressable>
  )
}

// Date, countdown chip and people count under the `3c` title. The chip
// inverts the text colour: green on a light pattern, paper otherwise.
function CoverDetails({
  eventId,
  date,
  tone,
}: {
  eventId: string
  date: string
  tone: CoverTone
}) {
  const { t, i18n } = useTranslation()
  const { participants } = useEventParticipants(eventId)
  const when = eventWhen(t, i18n.language, date, new Date())
  const light = tone === 'light'
  const textColor = coverTextColor(tone)

  return (
    <View className="flex-row flex-wrap items-center gap-x-2.5 gap-y-1.5">
      <Text className={`text-sm font-semibold ${textColor}`}>{when.date}</Text>
      {when.countdown ? (
        <View
          className={`rounded-full px-2.5 py-0.5 ${
            light ? 'bg-garland-green' : 'bg-garland-paper'
          }`}
        >
          <Text
            className={`text-xs font-bold ${
              light ? 'text-garland-paper' : 'text-garland-green'
            }`}
          >
            {when.countdown}
          </Text>
        </View>
      ) : null}
      {participants.length > 0 ? (
        <Text className={`text-sm ${textColor}`}>
          {t('home.people', { count: participants.length })}
        </Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  cover: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    overflow: 'hidden',
  },
  scrim: { backgroundColor: 'rgba(29,26,20,0.38)' },
  barTitle: { flex: 1 },
  details: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    gap: 8,
    paddingHorizontal: 22,
    paddingBottom: 20,
  },
})
