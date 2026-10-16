import { router, useFocusEffect } from 'expo-router'
import { setStatusBarStyle } from 'expo-status-bar'
import { useCallback, useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Linking,
  Platform,
  Pressable,
  View,
  useWindowDimensions,
} from 'react-native'
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedReaction,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { scheduleOnRN } from 'react-native-worklets'

import { addedGiftId, claimGift, unclaimGift } from '@/api/gifts'
import {
  type FailureReason,
  type GiftWrite,
  type GiftWriteKind,
  type ShownGift,
  giftWrite,
  shownBuyers,
  viewerClaimOf,
  withQueuedGifts,
} from '@/api/pendingWrites'
import {
  type ClaimAction,
  canEditGift,
  claimAction,
  isHiddenFrom,
  isOwnWish,
} from '@/api/presentLists'
import { presentTheme } from '@/api/stockArt'
import { BackIcon, LinkIcon, PencilIcon } from '@/components/ui/icon'
import { Text } from '@/components/ui/text'
import { garland } from '@/constants/colors'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useEventById } from '@/hooks/useEventById'
import { useEventParticipants } from '@/hooks/useEventParticipants'
import { useGiftById } from '@/hooks/useGiftById'
import { useOffline } from '@/hooks/useOffline'
import { usePersonName } from '@/hooks/usePersonName'
import { useQueuedWrites } from '@/hooks/useQueuedWrites'
import { useSeenOnScreen } from '@/hooks/useSeenOnScreen'
import { errorMessage } from '@/localization/errorMessage'
import { discardWrite } from '@/sync'
import { DollarIcon } from '@/ui/components/BuyerSeal'
import { BuyersStamp, randomStampEntrance } from '@/ui/components/BuyersStamp'
import { ChatRecapBox } from '@/ui/components/ChatRecapBox'
import { GarlandButton, GarlandButtonText } from '@/ui/components/GarlandButton'
import { FAILED_KEY } from '@/ui/components/GiftRow'
import { TONE_COLOR } from '@/ui/components/GiftTag'
import { PersonAvatar } from '@/ui/components/PersonAvatar'
import { ScreenHeader } from '@/ui/components/ScreenHeader'
import { PresentHero } from '@/ui/components/presentHero/PresentHero'

const CTA_KEY: Record<ClaimAction, string> = {
  claim: 'present.claim',
  claimToo: 'present.claimToo',
  unclaim: 'present.unclaim',
}

// How small the picture gets before the details start sliding over it.
const MIN_SCALE = 0.5

const hrefOf = (url: string) =>
  /^https?:\/\//i.test(url) ? url : `https://${url}`

// The link's site, for its tag: `https://www.onet.pl/x` → `onet.pl`.
const hostOf = (url: string) =>
  url
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .split(/[/?#]/)[0]

// `1e`: a present's photo or illustration, who it's for and who added it,
// its description and link, and — for everyone but its recipient — who is
// buying it and the claim/unclaim action. Whoever added it can edit it
// (and delete it from there). A present (or a claim) still in
// the offline queue shows as waiting, or as failed with Discard
// (docs/spec.md §6.4).
export function PresentDetailScreen({
  eventId,
  giftId,
}: {
  eventId: string
  giftId: string
}) {
  const { t } = useTranslation()
  const offline = useOffline()
  const user = useCurrentUser()
  const { event } = useEventById(eventId)
  const writes = useQueuedWrites()
  // Opened on a queued add that has since been added: follow it to the
  // server's copy. Re-read whenever the queue changes.
  const shownId = addedGiftId(giftId) ?? giftId
  const { gift: serverGift, ready } = useGiftById(shownId, eventId)
  // Not on the server: an add still in the queue, or a present since removed
  // that a failed claim was about.
  const gift: ShownGift | undefined =
    serverGift ??
    withQueuedGifts([], writes, eventId, user?._id).find(g => g._id === giftId)
  const write = giftWrite(writes, serverGift?._id ?? giftId)
  const queuedAdd = write?.kind === 'add'
  const { resolve, resolveUser } = useEventParticipants(eventId)
  const nameOf = usePersonName()

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const insets = useSafeAreaInsets()
  const { width, height: windowHeight } = useWindowDimensions()

  // The picture stays put behind the details. Scrolling first shrinks it
  // (its top fixed, its bottom keeping clear of the details), then the
  // details slide up over it. Pulling down past the top grows it instead.
  const tile = Math.min(width - 96, 300)
  const tileTop = insets.top + 64
  const heroHeight = tileTop + tile + 56
  const scrollY = useSharedValue(0)
  const onScroll = useAnimatedScrollHandler(e => {
    scrollY.set(e.contentOffset.y)
  })
  const heroStyle = useAnimatedStyle(() => ({
    // Follows the details down when pulled past the top. Android's stretch
    // overscroll moves them down without a negative offset, so there it
    // reaches down behind them from the start.
    height:
      Platform.OS === 'android'
        ? Math.max(heroHeight, windowHeight)
        : heroHeight + Math.max(0, -scrollY.get()),
  }))
  const tileStyle = useAnimatedStyle(() => {
    const scale = interpolate(
      scrollY.get(),
      [-tile, 0, (1 - MIN_SCALE) * tile],
      [2, 1, MIN_SCALE],
      Extrapolation.CLAMP,
    )
    return {
      transform: [{ translateY: ((scale - 1) * tile) / 2 }, { scale }],
    }
  })

  // A light status bar while the picture's coloured backdrop is behind it,
  // dark once the details have slid up under it.
  const [overHero, setOverHero] = useState(true)
  useAnimatedReaction(
    () => scrollY.get() < heroHeight - insets.top / 2,
    (over, before) => {
      if (over !== before) scheduleOnRN(setOverHero, over)
    },
  )
  // The buyers stamp arrives, a different way each time the screen opens,
  // once the viewer can see all of it.
  const [stampEntrance] = useState(randomStampEntrance)
  const [stampRef, onStampLayout, stampSeen] = useSeenOnScreen(scrollY)

  const shown =
    !!gift && !!event && !!user && !isHiddenFrom(event, gift, user._id)
  const light = shown && overHero
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle(light ? 'light' : 'dark')
      return () => setStatusBarStyle('dark')
    }, [light]),
  )

  // A suggestion for the viewer (a stale local copy) reads as missing.
  if (!gift || !event || !user || isHiddenFrom(event, gift, user._id)) {
    return (
      <SafeAreaView className="flex-1 bg-garland-paper">
        <ScreenHeader title={t('shell.present')} variant="back" />
        <View className="flex-1 items-center justify-center px-7">
          <Text className="text-center text-sm text-garland-ink-60">
            {ready ? t('present.notFound') : t('present.loading')}
          </Text>
        </View>
      </SafeAreaView>
    )
  }

  const recipient = resolve(gift.forParticipantId)
  const creator = resolveUser(gift.createdBy)
  const action = claimAction(event, gift, user._id)
  // Green for the recipient's own wish, berry for someone's suggestion.
  const tone = TONE_COLOR[isOwnWish(event, gift) ? 'own' : 'suggested']
  // Only ever resolved for a viewer who may see them (claim-quietly rule).
  const buyers = action
    ? shownBuyers(gift, write, user._id).map(id => resolveUser(id))
    : []
  const avatarOf = (person: typeof recipient, size = 18) => (
    <PersonAvatar person={person} size={size} />
  )

  // Only offered for a present the server has.
  const toggleClaim = () => {
    if (!action || !serverGift || submitting) return
    setError(null)
    setSubmitting(true)
    const call = action === 'unclaim' ? unclaimGift : claimGift
    call(serverGift)
      .catch((err: unknown) =>
        setError(errorMessage(err, t('common.somethingWentWrong'))),
      )
      .finally(() => setSubmitting(false))
  }

  const edit = () =>
    router.push({
      pathname: '/event/[eventId]/add-gift',
      params: { eventId, giftId: gift._id },
    })

  const discard = (failed: GiftWrite) => {
    discardWrite(failed.id)
    // A present only the write was keeping on screen goes with it.
    if (!serverGift) router.back()
  }

  const showBuyers =
    !!action && !queuedAdd && (buyers.length > 0 || !!viewerClaimOf(write))

  return (
    <View className="flex-1 bg-garland-paper">
      {/* The picture, staged by its theme on the tone's colour, edge to
          edge behind the details. */}
      <PresentHero
        theme={presentTheme(gift.theme, gift._id)}
        gift={gift}
        tone={tone}
        tile={tile}
        tileTop={tileTop}
        width={width}
        height={heroHeight}
        pending={queuedAdd && write.state === 'pending'}
        heroStyle={heroStyle}
        tileStyle={tileStyle}
      />

      <Animated.ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: heroHeight }}
      >
        {/* However short the details, they can slide up over the whole
            picture, to just under the round buttons. */}
        <View
          className="bg-garland-paper"
          style={{
            minHeight: windowHeight - tileTop,
            paddingBottom: insets.bottom + 48,
          }}
        >
          <Perforation width={width} />

          <View className="px-6 pt-5">
            <Text
              className="text-[11px] font-bold uppercase tracking-[2px]"
              style={{ color: tone }}
            >
              {isOwnWish(event, gift)
                ? t('present.ownWish')
                : t('present.suggestion')}
            </Text>
            <Text className="mt-2 font-garland-display text-[34px] leading-[40px] text-garland-ink">
              {gift.title}
            </Text>

            <View className="mt-4 flex-row flex-wrap items-center gap-x-4 gap-y-2">
              <MetaPerson
                label={t('present.for')}
                avatar={avatarOf(recipient, 20)}
                name={nameOf(recipient)}
              />
              <MetaPerson
                label={t('present.addedBy')}
                avatar={avatarOf(creator, 20)}
                name={nameOf(creator)}
              />
            </View>

            {gift.description ? (
              <Text className="mt-6 text-base leading-[25px] text-garland-ink">
                {gift.description}
              </Text>
            ) : null}

            {gift.url ? (
              <Pressable
                onPress={() => void Linking.openURL(hrefOf(gift.url!))}
                accessibilityRole="link"
                accessibilityLabel={gift.url}
                hitSlop={6}
                className="mt-5 max-w-full flex-row items-center gap-2 self-start rounded-full border border-dashed border-garland-green px-4 py-2 active:opacity-60"
              >
                <LinkIcon width={14} height={14} color={garland.green} />
                <Text
                  className="shrink text-[14px] font-bold text-garland-green"
                  numberOfLines={1}
                >
                  {hostOf(gift.url)}
                </Text>
              </Pressable>
            ) : null}

            {/* Buyers coordinate in the recipient's thread, which the
              recipient is never sent: on their own present it's absent. */}
            <ChatRecapBox
              eventId={eventId}
              participantId={gift.forParticipantId}
              label={t('chat.presentRecap', { name: nameOf(recipient) })}
              labelLeading={avatarOf(recipient, 24)}
              withAvatars
              className="mt-8"
            />

            {/* Not for the recipient (claim-quietly rule), and not at all
              while nobody is buying it. */}
            {showBuyers ? (
              <Animated.View
                ref={stampRef}
                onLayout={onStampLayout}
                className="mt-8"
              >
                <BuyersStamp
                  entrance={stampEntrance}
                  label={t('present.buying')}
                  play={stampSeen}
                  lines={[
                    ...buyers.map((buyer, i) => (
                      <Text
                        key={i}
                        className="text-sm font-bold text-garland-ink"
                      >
                        {nameOf(buyer)}
                      </Text>
                    )),
                    ...(viewerClaimOf(write)
                      ? [
                          <Text
                            key="you"
                            className={`text-sm font-bold ${
                              viewerClaimOf(write) === 'failed'
                                ? 'text-garland-berry line-through'
                                : 'text-garland-green'
                            }`}
                          >
                            {viewerClaimOf(write) === 'failed'
                              ? t('person.you')
                              : `${t('person.you')} · ⏱`}
                          </Text>,
                        ]
                      : []),
                  ]}
                />
              </Animated.View>
            ) : null}

            {queuedAdd ? (
              write.state === 'failed' ? (
                <FailedWrite write={write} onDiscard={() => discard(write)} />
              ) : (
                <WaitingNote>
                  {action ? t('offline.addWaitingNote') : t('offline.willAdd')}
                </WaitingNote>
              )
            ) : action ? (
              <>
                {write?.state === 'failed' ? (
                  <FailedWrite write={write} onDiscard={() => discard(write)} />
                ) : write ? (
                  <WaitingCta kind={write.kind} />
                ) : (
                  // Claiming works offline too: it's queued.
                  <GarlandButton
                    variant={action === 'unclaim' ? 'outline' : 'solid'}
                    className="mt-8"
                    loading={submitting}
                    onPress={toggleClaim}
                  >
                    {action === 'claim' ? (
                      <DollarIcon size={18} color={garland.paper} />
                    ) : null}
                    <GarlandButtonText>{t(CTA_KEY[action])}</GarlandButtonText>
                  </GarlandButton>
                )}
                {error ? (
                  <Text className="mt-3 text-xs text-garland-berry">
                    {error}
                  </Text>
                ) : null}
              </>
            ) : null}
          </View>
        </View>
      </Animated.ScrollView>

      {/* Over the picture, so round buttons rather than a header bar. */}
      <View
        pointerEvents="box-none"
        className="absolute inset-x-0 flex-row items-center justify-between px-5"
        style={{ top: insets.top + 8 }}
      >
        <RoundButton
          onPress={() => router.back()}
          accessibilityLabel={t('shell.back')}
        >
          <BackIcon width={20} height={20} color={garland.ink} />
        </RoundButton>
        {canEditGift(gift, user._id) && serverGift ? (
          <RoundButton
            onPress={edit}
            disabled={offline}
            accessibilityLabel={t('present.edit')}
          >
            <PencilIcon width={18} height={18} color={garland.ink} />
          </RoundButton>
        ) : null}
      </View>
    </View>
  )
}

// The tear-off edge under the picture: a row of paper-coloured holes
// straddling it, as between a gift tag's stub and its details.
function Perforation({ width }: { width: number }) {
  return (
    <View className="flex-row justify-between px-1">
      {Array.from({ length: Math.floor(width / 17) }, (_, i) => (
        <View
          key={i}
          className="-mt-[5px] h-2.5 w-2.5 rounded-full bg-garland-paper"
        />
      ))}
    </View>
  )
}

function MetaPerson({
  label,
  avatar,
  name,
}: {
  label: string
  avatar: ReactNode
  name: string
}) {
  return (
    <View className="max-w-full flex-row items-center gap-1.5">
      <Text className="text-[13px] text-garland-ink-60">{label}</Text>
      {avatar}
      <Text
        className="shrink text-[13px] font-bold text-garland-ink"
        numberOfLines={1}
      >
        {name}
      </Text>
    </View>
  )
}

function RoundButton({
  onPress,
  disabled = false,
  accessibilityLabel,
  children,
}: {
  onPress: () => void
  disabled?: boolean
  accessibilityLabel: string
  children: ReactNode
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      className={`h-11 w-11 items-center justify-center rounded-full bg-garland-paper active:opacity-70 ${disabled ? 'opacity-40' : ''}`}
      style={{
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
      }}
    >
      {children}
    </Pressable>
  )
}

const WAITING_CTA_KEY: Record<GiftWriteKind, string> = {
  add: 'offline.willAdd',
  claim: 'offline.claimWaitingCta',
  unclaim: 'offline.unclaimWaitingCta',
}

// A queued claim or unclaim in place of the call to action: a dashed, muted
// button that can't be pressed until it has gone through.
function WaitingCta({ kind }: { kind: GiftWriteKind }) {
  const { t } = useTranslation()
  return (
    <View
      accessibilityState={{ disabled: true }}
      className="mt-10 items-center rounded-full border-[1.5px] border-dashed border-garland-green px-[18px] py-[13px] opacity-70"
    >
      <Text className="text-center text-sm font-semibold text-garland-green">
        {t(WAITING_CTA_KEY[kind])}
      </Text>
    </View>
  )
}

// A queued present, in place of the call to action.
function WaitingNote({ children }: { children: string }) {
  return (
    <View className="mt-10 rounded-2xl border-[1.5px] border-dashed border-garland-amber px-3.5 py-3">
      <Text className="text-center text-xs leading-[17px] text-garland-ink-60">
        {children}
      </Text>
    </View>
  )
}

// A rejected replay: what didn't go through, why, and Discard.
function FailedWrite({
  write,
  onDiscard,
}: {
  write: GiftWrite
  onDiscard: () => void
}) {
  const { t } = useTranslation()
  const reason: FailureReason = write.reason ?? 'other'
  return (
    <View className="mt-10 items-center rounded-2xl border-[1.5px] border-garland-berry px-3.5 py-3">
      <Text className="text-center text-xs font-bold leading-[17px] text-garland-berry">
        {t(FAILED_KEY[write.kind])}
      </Text>
      <Text className="mt-1 text-center text-xs leading-[17px] text-garland-berry">
        {t(`offline.reasons.${reason}`)}
      </Text>
      <Pressable
        onPress={onDiscard}
        hitSlop={10}
        accessibilityRole="button"
        className="mt-3"
      >
        <Text className="text-xs font-bold text-garland-berry underline">
          {t('offline.discard')}
        </Text>
      </Pressable>
    </View>
  )
}
