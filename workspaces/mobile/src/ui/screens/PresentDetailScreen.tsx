import { router } from 'expo-router'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Linking, Pressable, ScrollView, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

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
import { LinkIcon, PencilIcon } from '@/components/ui/icon'
import { Text } from '@/components/ui/text'
import { garland } from '@/constants/colors'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useEventById } from '@/hooks/useEventById'
import { useEventParticipants } from '@/hooks/useEventParticipants'
import { useGiftById } from '@/hooks/useGiftById'
import { useOffline } from '@/hooks/useOffline'
import { usePersonName } from '@/hooks/usePersonName'
import { useQueuedWrites } from '@/hooks/useQueuedWrites'
import { errorMessage } from '@/localization/errorMessage'
import { discardWrite } from '@/sync'
import { BuyerSeal, DollarIcon } from '@/ui/components/BuyerSeal'
import { ChatRecapBox } from '@/ui/components/ChatRecapBox'
import { GarlandButton, GarlandButtonText } from '@/ui/components/GarlandButton'
import { FAILED_KEY } from '@/ui/components/GiftRow'
import { TONE_COLOR } from '@/ui/components/GiftTag'
import { PersonAvatar } from '@/ui/components/PersonAvatar'
import { PresentTile } from '@/ui/components/PresentTile'
import { ScreenHeader } from '@/ui/components/ScreenHeader'

const CTA_KEY: Record<ClaimAction, string> = {
  claim: 'present.claim',
  claimToo: 'present.claimToo',
  unclaim: 'present.unclaim',
}

const hrefOf = (url: string) =>
  /^https?:\/\//i.test(url) ? url : `https://${url}`

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

  return (
    <SafeAreaView className="flex-1 bg-garland-paper">
      <ScreenHeader
        title={recipient?.name ?? nameOf(recipient)}
        leading={avatarOf(recipient, 32)}
        variant="back"
        right={
          canEditGift(gift, user._id) && serverGift ? (
            <Pressable
              onPress={edit}
              disabled={offline}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityState={{ disabled: offline }}
              className={`flex-row items-center gap-1.5 active:opacity-60 ${offline ? 'opacity-40' : ''}`}
            >
              <PencilIcon width={16} height={16} color={garland.ink} />
              <Text className="text-sm font-bold text-garland-ink">
                {t('present.edit')}
              </Text>
            </Pressable>
          ) : undefined
        }
      />
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        <View className="flex-row flex-wrap gap-2 px-[22px] pt-2">
          <Tag label={t('present.for')}>
            <TagPerson avatar={avatarOf(recipient)} name={nameOf(recipient)} />
          </Tag>
          <Tag label={t('present.addedBy')}>
            <TagPerson avatar={avatarOf(creator)} name={nameOf(creator)} />
          </Tag>
        </View>

        <View className="items-center px-[22px] pt-4">
          {/* Framed in the tone's colour, as on the person's list. */}
          <View
            className="rounded-[28px] p-1"
            style={[
              { backgroundColor: tone },
              queuedAdd && write.state === 'pending'
                ? { opacity: 0.55 }
                : undefined,
            ]}
          >
            <PresentTile
              gift={gift}
              size={220}
              imageSize={190}
              radius={24}
              derivative={1000}
              pending={queuedAdd && write.state === 'pending'}
            />
            {/* Same rule as the buyers chip below. */}
            {action &&
            !queuedAdd &&
            (buyers.length > 0 || viewerClaimOf(write) === 'waiting') ? (
              <View className="absolute -bottom-4 -right-4">
                <BuyerSeal size={64} />
              </View>
            ) : null}
          </View>
        </View>

        <View className="px-[22px] pt-8">
          <Text className="text-center font-garland-display text-[30px] leading-[36px] text-garland-ink">
            {gift.title}
          </Text>

          {gift.description ? (
            <Text className="mt-6 text-base leading-[24px] text-garland-ink">
              {gift.description}
            </Text>
          ) : null}

          {gift.url ? (
            <Pressable
              onPress={() => void Linking.openURL(hrefOf(gift.url!))}
              accessibilityRole="link"
              hitSlop={6}
              className="mt-4 flex-row items-center gap-1.5 active:opacity-60"
            >
              <LinkIcon width={14} height={14} color={garland.green} />
              <Text
                className="flex-1 text-[15px] font-bold text-garland-green"
                numberOfLines={1}
              >
                {gift.url}
              </Text>
            </Pressable>
          ) : null}

          {/* Not for the recipient (claim-quietly rule), and not at all
              while nobody is buying it. */}
          {action &&
          !queuedAdd &&
          (buyers.length > 0 || viewerClaimOf(write)) ? (
            <View className="mt-4 flex-row justify-end">
              <Tag label={t('present.buying')} strong wrap>
                {buyers.map((buyer, i) => (
                  <TagPerson
                    key={i}
                    avatar={avatarOf(buyer)}
                    name={nameOf(buyer)}
                    strong
                  />
                ))}
                {viewerClaimOf(write) ? (
                  <TagPerson
                    avatar={avatarOf(resolveUser(user._id))}
                    name={
                      viewerClaimOf(write) === 'failed'
                        ? t('person.you')
                        : `${t('person.you')} · ⏱`
                    }
                    className={
                      viewerClaimOf(write) === 'failed'
                        ? 'text-garland-berry line-through'
                        : 'text-garland-green'
                    }
                    strong
                  />
                ) : null}
              </Tag>
            </View>
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
                <Text className="mt-3 text-xs text-garland-berry">{error}</Text>
              ) : null}
            </>
          ) : null}

          {/* Buyers coordinate in the recipient's thread, which the
              recipient is never sent: on their own present it's absent. */}
          <ChatRecapBox
            eventId={eventId}
            participantId={gift.forParticipantId}
            label={t('chat.presentRecap', { name: nameOf(recipient) })}
            labelLeading={avatarOf(recipient, 24)}
            withAvatars
            className="mt-10"
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

// A chip: "Label: <avatar> Name …". `strong` for the buyers, so who is
// buying it stands out.
// One line, its name cut short when it can't fit. `wrap` lets several
// people break onto more lines instead, e.g. everyone buying.
function Tag({
  label,
  strong = false,
  wrap = false,
  children,
}: {
  label: string
  strong?: boolean
  wrap?: boolean
  children: ReactNode
}) {
  return (
    <View
      className={`max-w-full flex-row items-center gap-x-1.5 gap-y-1 rounded-full py-1 pl-2.5 pr-2.5 ${
        wrap ? 'flex-wrap' : ''
      } ${
        strong
          ? 'border-[1.5px] border-garland-ink-40'
          : 'border border-garland-ink-15'
      }`}
    >
      <Text
        className={`text-[12px] ${strong ? 'font-bold text-garland-ink' : 'font-semibold text-garland-ink-60'}`}
      >
        {label}
      </Text>
      {children}
    </View>
  )
}

function TagPerson({
  avatar,
  name,
  strong = false,
  className,
}: {
  avatar: ReactNode
  name: string
  strong?: boolean
  // Overrides the name's colour.
  className?: string
}) {
  return (
    <View className="min-w-0 shrink flex-row items-center gap-1">
      {avatar}
      <Text
        numberOfLines={1}
        className={`shrink text-[12px] ${strong ? 'font-bold' : 'font-semibold'} ${
          className ?? (strong ? 'text-garland-ink' : 'text-garland-ink-60')
        }`}
      >
        {name}
      </Text>
    </View>
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
      className="mt-8 items-center rounded-full border-[1.5px] border-dashed border-garland-green px-[18px] py-[13px] opacity-70"
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
    <View className="mt-8 rounded-2xl border-[1.5px] border-dashed border-garland-amber px-3.5 py-3">
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
    <View className="mt-8 items-center rounded-2xl border-[1.5px] border-garland-berry px-3.5 py-3">
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
