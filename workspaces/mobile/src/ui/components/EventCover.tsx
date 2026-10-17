import type { EventDoc } from '@prezentowo/types'
import { useFocusEffect, useNavigation } from 'expo-router'
import { DrawerActions } from 'expo-router/react-navigation'
import { setStatusBarStyle } from 'expo-status-bar'
import {
  type ReactNode,
  type Ref,
  createContext,
  useCallback,
  useContext,
} from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native'
import Animated, {
  Extrapolation,
  type SharedValue,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { type CoverTone, coverTone } from '@/api/stockArt'
import { HamburgerIcon } from '@/components/ui/icon'
import { Text } from '@/components/ui/text'
import { garland } from '@/constants/colors'
import { useEventParticipants } from '@/hooks/useEventParticipants'
import { eventWhen } from '@/localization/eventDates'
import { EventBackground } from '@/ui/components/EventBackground'

// The cover below the status bar: `3c` fully open, `3c3` collapsed to the
// bar holding ☰.
const COVER_HEIGHT = 280
const BAR_HEIGHT = 56
// The content's side padding, for full-bleed rows to undo.
export const COVER_GUTTER = 22

// How the cover sits over the content, for content that tracks it (e.g. a
// header that sticks under it). Offsets are in the scroll content's
// coordinates, which start with `expanded` of padding.
export type CoverScroll = {
  scrollY: SharedValue<number>
  // The cover's height fully open, and collapsed to its bar.
  expanded: number
  collapsed: number
}

const CoverScrollContext = createContext<CoverScroll | null>(null)

export function useCoverScroll(): CoverScroll {
  const scroll = useContext(CoverScrollContext)
  if (!scroll) throw new Error('useCoverScroll outside an EventCover')
  return scroll
}

// The cover's height at a scroll offset: it collapses over the first
// `expanded - collapsed` of scrolling, and stays that size.
export function coverHeightAt(
  scrollY: number,
  { expanded, collapsed }: Pick<CoverScroll, 'expanded' | 'collapsed'>,
) {
  'worklet'
  return interpolate(
    scrollY,
    [0, expanded - collapsed],
    [expanded, collapsed],
    Extrapolation.CLAMP,
  )
}

// Cover text sits straight on a stock pattern, in ink or paper to match its
// tone; a photo gets a scrim and paper text.
const coverTextColor = (tone: CoverTone) =>
  tone === 'light' ? 'text-garland-ink' : 'text-garland-paper'

// `3c`–`3c4`: an event section under the event's cover. The cover is an
// absolutely positioned header that collapses from `3c` to the compact `3c3`
// as the content scrolls, and stays that size.
export function EventCover({
  event,
  scrollRef,
  contentMinHeight,
  children,
}: {
  event: EventDoc
  scrollRef?: Ref<Animated.ScrollView>
  // Replaces the default: however short, the content scrolls far enough to
  // collapse the cover.
  contentMinHeight?: number
  children: ReactNode
}) {
  const insets = useSafeAreaInsets()
  const { height: windowHeight } = useWindowDimensions()
  const scrollY = useSharedValue(0)
  const tone = coverTone(event.background, event._id)
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
    height: coverHeightAt(scrollY.get(), { expanded, collapsed }),
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
      <CoverScrollContext.Provider value={{ scrollY, expanded, collapsed }}>
        <Animated.ScrollView
          ref={scrollRef}
          onScroll={onScroll}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingTop: expanded,
            paddingHorizontal: COVER_GUTTER,
            paddingBottom: insets.bottom + 24,
            minHeight: contentMinHeight ?? windowHeight + range,
          }}
        >
          {children}
        </Animated.ScrollView>
      </CoverScrollContext.Provider>

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
          <CoverDetails eventId={event._id} date={event.date} tone={tone} />
        </Animated.View>
      </Animated.View>
    </View>
  )
}

// ☰ on a paper chip. No ←: the drawer's "Back to home" is the way out.
function CoverButtons() {
  const { t } = useTranslation()
  const navigation = useNavigation()

  return (
    <Chip
      onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
      label={t('shell.openMenu')}
    >
      <HamburgerIcon width={20} height={20} color={garland.ink} />
    </Chip>
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
    paddingHorizontal: COVER_GUTTER,
    paddingBottom: 20,
  },
})
