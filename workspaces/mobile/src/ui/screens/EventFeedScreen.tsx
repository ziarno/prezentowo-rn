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

import { BackIcon, HamburgerIcon } from '@/components/ui/icon'
import { Text } from '@/components/ui/text'
import { garland } from '@/constants/colors'
import { useEventById } from '@/hooks/useEventById'
import { useEventParticipants } from '@/hooks/useEventParticipants'
import { useHasScreenBeneath } from '@/hooks/useHasScreenBeneath'
import { eventWhen } from '@/localization/eventDates'
import { EventBackground } from '@/ui/components/EventBackground'
import { ScreenHeader } from '@/ui/components/ScreenHeader'

// The cover below the status bar: `3c` fully open, `3c3` collapsed to the
// bar holding ☰.
const COVER_HEIGHT = 280
const BAR_HEIGHT = 56

// `3c`–`3c4`: the event's cover over its feed. The cover is an absolutely
// positioned header that collapses from `3c` to the compact `3c3` as the feed
// scrolls, and stays that size. The activity list lands with its own slice.
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

  return (
    <CollapsingCover
      event={event}
      cover={<CoverDetails eventId={eventId} date={event.date} />}
    >
      <Text className="py-10 text-center text-sm text-garland-ink-60">
        {t('shell.comingSoon')}
      </Text>
    </CollapsingCover>
  )
}

function CollapsingCover({
  event,
  cover,
  children,
}: {
  event: EventDoc
  // The `3c` details under the title; they fade as the cover collapses.
  cover: ReactNode
  children: ReactNode
}) {
  const insets = useSafeAreaInsets()
  const { height: windowHeight } = useWindowDimensions()
  const scrollY = useSharedValue(0)

  const expanded = insets.top + COVER_HEIGHT
  const collapsed = insets.top + BAR_HEIGHT
  const range = expanded - collapsed

  // The cover sits under a light status bar; screens above it are paper.
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle('light')
      return () => setStatusBarStyle('dark')
    }, []),
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
          {/* Until the stock patterns declare their tones (#43), text sits
              on a scrim so it reads on any photo or tint. */}
          <View style={[StyleSheet.absoluteFill, styles.scrim]} />
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
              className="font-garland-display text-lg text-garland-paper"
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
            className="font-garland-display text-[34px] leading-[38px] text-garland-paper"
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

// Date, countdown chip and people count under the `3c` title.
function CoverDetails({ eventId, date }: { eventId: string; date: string }) {
  const { t, i18n } = useTranslation()
  const { participants } = useEventParticipants(eventId)
  const when = eventWhen(t, i18n.language, date, new Date())

  return (
    <View className="flex-row flex-wrap items-center gap-x-2.5 gap-y-1.5">
      <Text className="text-sm font-semibold text-garland-paper">
        {when.date}
      </Text>
      {when.countdown ? (
        <View className="rounded-full bg-garland-paper px-2.5 py-0.5">
          <Text className="text-xs font-bold text-garland-ink">
            {when.countdown}
          </Text>
        </View>
      ) : null}
      {participants.length > 0 ? (
        <Text className="text-sm text-garland-paper">
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
