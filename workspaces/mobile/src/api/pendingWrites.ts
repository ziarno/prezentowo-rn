import type { AddGiftArgs, GiftDoc } from '@prezentowo/types'

import type { QueuedWrite, QueuedWriteState } from '@/sync'

import type { DraftImage } from './draftImage'

// How queued gift writes show (docs/spec.md §6.3, §6.4): a queued add as a
// present in its list, a queued claim or unclaim on its present.

// What a queued `gifts.add` holds: the photo may still be on the device (or
// a shop's server), uploaded when it's replayed.
export type QueuedAddGiftArgs = Omit<AddGiftArgs, 'image' | 'clientId'> & {
  image?: DraftImage
  clientId: string
}

// A present as the lists show it: from the server, or from the queue (its
// `_id` is then the add's `clientId`, and its photo may be local).
export type ShownGift = Omit<GiftDoc, 'image'> & { image?: DraftImage }

// Why a replay was rejected, for the screens to say. `other` for anything
// they have no words for.
export type FailureReason =
  | 'giftNotFound'
  | 'eventNotFound'
  | 'participantNotFound'
  | 'notAParticipant'
  | 'other'

const KNOWN_REASONS: Record<Exclude<FailureReason, 'other'>, true> = {
  giftNotFound: true,
  eventNotFound: true,
  participantNotFound: true,
  notAParticipant: true,
}

export type GiftWriteKind = 'add' | 'claim' | 'unclaim'

// The queued write a present shows. `reason` is set once it failed.
export type GiftWrite = {
  id: string
  kind: GiftWriteKind
  state: QueuedWriteState
  reason?: FailureReason
}

const KIND_OF: Record<string, GiftWriteKind> = {
  'gifts.add': 'add',
  'gifts.claim': 'claim',
  'gifts.unclaim': 'unclaim',
}

const giftIdOf = (write: QueuedWrite) =>
  write.method === 'gifts.add'
    ? (write.args as QueuedAddGiftArgs).clientId
    : (write.args as { giftId: string }).giftId

const reasonOf = (write: QueuedWrite): FailureReason => {
  const reason = write.failure?.reason
  return reason && Object.hasOwn(KNOWN_REASONS, reason)
    ? (reason as FailureReason)
    : 'other'
}

/**
 * The write a present shows: its queued add, for one shown from the queue,
 * or the latest queued claim or unclaim of it.
 */
export function giftWrite(
  writes: QueuedWrite[],
  giftId: string,
): GiftWrite | undefined {
  const write = writes.findLast(
    w => KIND_OF[w.method] && giftIdOf(w) === giftId,
  )
  if (!write) return undefined
  return {
    id: write.id,
    kind: KIND_OF[write.method]!,
    state: write.state,
    ...(write.state === 'failed' ? { reason: reasonOf(write) } : {}),
  }
}

// A queued claim or unclaim's `meta`: the present as it was claimed, so a
// failed one can still be shown once the present is gone from the server.
export type ClaimMeta = { gift: GiftDoc }

/**
 * The event's presents, newest first, with the ones queued for adding among
 * them — and any the server no longer has that a failed claim or unclaim
 * was about, kept in place for its Discard.
 */
export function withQueuedGifts(
  gifts: GiftDoc[],
  writes: QueuedWrite[],
  eventId: string,
  viewerUserId: string | undefined,
): ShownGift[] {
  const shown = new Set(gifts.map(g => g._id))
  const queued = writes.flatMap((write): ShownGift[] => {
    if (write.method !== 'gifts.add') {
      const removed = (write.meta as ClaimMeta | undefined)?.gift
      if (
        write.state !== 'failed' ||
        removed?.eventId !== eventId ||
        shown.has(removed._id)
      ) {
        return []
      }
      shown.add(removed._id)
      return [removed]
    }
    const { clientId, ...args } = write.args as QueuedAddGiftArgs
    if (args.eventId !== eventId || !viewerUserId) return []
    return [
      {
        _id: clientId,
        ...args,
        claimedBy: [],
        createdBy: viewerUserId,
        createdAt: write.queuedAt,
      },
    ]
  })
  return [...queued, ...gifts].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  )
}

// The viewer's own claim while it's queued, as the buyer chips show it:
// waiting to send, or failed.
export type ViewerClaim = 'waiting' | 'failed'

export function viewerClaimOf(
  write: GiftWrite | undefined,
): ViewerClaim | undefined {
  if (write?.kind !== 'claim') return undefined
  return write.state === 'pending' ? 'waiting' : 'failed'
}

// Who a present shows as being bought by: an unclaim waiting to send already
// takes the viewer off.
export function shownBuyers(
  gift: Pick<GiftDoc, 'claimedBy'>,
  write: GiftWrite | undefined,
  viewerUserId: string | undefined,
): string[] {
  const claimedBy = gift.claimedBy ?? []
  return write?.kind === 'unclaim' && write.state === 'pending'
    ? claimedBy.filter(id => id !== viewerUserId)
    : claimedBy
}

// The writes still waiting to send, for the offline banner.
export function waitingCount(writes: QueuedWrite[]): number {
  return writes.filter(w => w.state === 'pending').length
}
