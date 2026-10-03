import { router } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, Linking, Pressable, ScrollView, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { addedGiftId, claimGift, removeGift, unclaimGift } from '@/api/gifts'
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
  canRemoveGift,
  claimAction,
  claimCountForRemoval,
  isHiddenFrom,
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
import { BuyerChips } from '@/ui/components/BuyerChips'
import { GarlandButton, GarlandButtonText } from '@/ui/components/GarlandButton'
import { FAILED_KEY } from '@/ui/components/GiftRow'
import { LockNote } from '@/ui/components/LockNote'
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
// buying it and the claim/unclaim action. Whoever added it can edit it;
// they or the event creator can delete it. A present (or a claim) still in
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
  const [removing, setRemoving] = useState(false)
  const [removeError, setRemoveError] = useState<string | null>(null)

  // A suggestion for the viewer (a stale local copy) reads as missing.
  if (!gift || !event || !user || isHiddenFrom(event, gift, user._id)) {
    return (
      <SafeAreaView className="flex-1 bg-garland-paper">
        <ScreenHeader title={t('shell.present')} />
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
  // Only ever resolved for a viewer who may see them (claim-quietly rule).
  const buyers = action
    ? shownBuyers(gift, write, user._id).map(id => nameOf(resolveUser(id)))
    : []

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

  const remove = async () => {
    setRemoveError(null)
    setRemoving(true)
    try {
      await removeGift(gift._id)
      router.back()
    } catch (err) {
      setRemoveError(errorMessage(err, t('common.somethingWentWrong')))
      setRemoving(false)
    }
  }

  const confirmRemove = () => {
    const claimCount = claimCountForRemoval(gift)
    Alert.alert(
      t('present.deleteTitle', { title: gift.title }),
      [
        t('present.deleteMessage'),
        claimCount ? t('present.deleteClaimed', { count: claimCount }) : null,
      ]
        .filter(Boolean)
        .join(' '),
      [
        { text: t('present.deleteCancel'), style: 'cancel' },
        {
          text: t('present.delete'),
          style: 'destructive',
          onPress: () => void remove(),
        },
      ],
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-garland-paper">
      <ScreenHeader
        title={event.title}
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
        <View className="items-center px-[22px] pt-2">
          <View
            style={
              queuedAdd && write.state === 'pending'
                ? { opacity: 0.55 }
                : undefined
            }
          >
            <PresentTile
              gift={gift}
              size={220}
              imageSize={190}
              radius={24}
              derivative={1000}
              pending={queuedAdd && write.state === 'pending'}
            />
          </View>
        </View>

        <View className="px-[22px] pt-5">
          <Text className="font-garland-display text-[30px] leading-[34px] text-garland-ink">
            {gift.title}
          </Text>

          <View className="mt-3 flex-row flex-wrap gap-1.5">
            <Tag>
              {recipient?.isYou
                ? t('present.forYou')
                : t('present.forName', { name: nameOf(recipient) })}
            </Tag>
            <Tag>
              {creator?.isYou
                ? t('present.addedByYou')
                : t('present.addedBy', { name: nameOf(creator) })}
            </Tag>
          </View>

          {gift.description ? (
            <Text className="mt-4 text-sm leading-[21px] text-garland-ink-60">
              {gift.description}
            </Text>
          ) : null}

          {gift.url ? (
            <Pressable
              onPress={() => void Linking.openURL(hrefOf(gift.url!))}
              accessibilityRole="link"
              hitSlop={6}
              className="mt-3 flex-row items-center gap-1.5 active:opacity-60"
            >
              <LinkIcon width={14} height={14} color={garland.green} />
              <Text
                className="flex-1 text-[13px] font-bold text-garland-green"
                numberOfLines={1}
              >
                {gift.url}
              </Text>
            </Pressable>
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
              <Text className="mb-2 mt-6 text-[11px] font-bold uppercase tracking-[1.1px] text-garland-ink-40">
                {t('present.buying')}
              </Text>
              {buyers.length > 0 || viewerClaimOf(write) ? (
                <BuyerChips names={buyers} viewerClaim={viewerClaimOf(write)} />
              ) : (
                <Text className="text-sm text-garland-ink-60">
                  {t('present.nobodyBuying')}
                </Text>
              )}
              {write?.state === 'failed' ? (
                <FailedWrite write={write} onDiscard={() => discard(write)} />
              ) : write ? (
                <WaitingCta kind={write.kind} />
              ) : (
                // Claiming works offline too: it's queued.
                <GarlandButton
                  variant={action === 'unclaim' ? 'outline' : 'solid'}
                  className="mt-6"
                  loading={submitting}
                  onPress={toggleClaim}
                >
                  <GarlandButtonText>{t(CTA_KEY[action])}</GarlandButtonText>
                </GarlandButton>
              )}
              {error ? (
                <Text className="mt-3 text-xs text-garland-berry">{error}</Text>
              ) : null}
            </>
          ) : (
            <LockNote className="mt-6">{t('present.onYourList')}</LockNote>
          )}

          {canRemoveGift(event, gift, user._id) && serverGift ? (
            <View className="mt-10 border-t border-garland-ink-08 pt-5">
              <GarlandButton
                variant="link"
                onPress={confirmRemove}
                loading={removing}
                disabled={offline}
                className="self-start"
                hitSlop={12}
              >
                <GarlandButtonText className="text-sm font-bold text-garland-berry">
                  {t('present.delete')}
                </GarlandButtonText>
              </GarlandButton>
              {removeError ? (
                <Text className="mt-3 text-xs text-garland-berry">
                  {removeError}
                </Text>
              ) : null}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function Tag({ children }: { children: string }) {
  return (
    <View className="rounded-full border border-garland-ink-15 px-2.5 py-1">
      <Text className="text-[11px] font-semibold text-garland-ink-60">
        {children}
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
      className="mt-6 items-center rounded-full border-[1.5px] border-dashed border-garland-green px-[18px] py-[13px] opacity-70"
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
    <View className="mt-6 rounded-2xl border-[1.5px] border-dashed border-garland-amber px-3.5 py-3">
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
    <View className="mt-6 items-center rounded-2xl border-[1.5px] border-garland-berry px-3.5 py-3">
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
