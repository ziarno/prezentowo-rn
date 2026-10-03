import type { GiftDoc, UpdateGiftArgs } from '@prezentowo/types'

import type { ClaimMeta, QueuedAddGiftArgs } from '@/api/pendingWrites'
import { call, collection, submit } from '@/sync'

export const Gifts = collection<GiftDoc>('gifts')

export function findGiftsByEvent(eventId: string): GiftDoc[] {
  return Gifts.find({ eventId }, { sort: { createdAt: -1 } }).fetch()
}

export function findGiftById(giftId: string): GiftDoc | undefined {
  return Gifts.findOne(giftId)
}

// `gifts.add`, `gifts.claim` and `gifts.unclaim` go through the offline
// queue (`@/api/queuedWrites`): offline they resolve at once with
// `'queued'`, and are sent when the session is back.

export function addGift(args: QueuedAddGiftArgs) {
  return submit('gifts.add', args)
}

// A queued add's `clientId` → the id the server gave its present, so a
// screen opened on it while it was queued can follow it once it's added.
const addedIds = new Map<string, string>()

export function rememberAddedGift(clientId: string, giftId: string) {
  addedIds.set(clientId, giftId)
}

export function addedGiftId(clientId: string): string | undefined {
  return addedIds.get(clientId)
}

export function updateGift(args: UpdateGiftArgs): Promise<void> {
  return call('gifts.update', args)
}

export function removeGift(giftId: string): Promise<void> {
  return call('gifts.remove', { giftId })
}

// The present is kept with a queued claim, to show it should the claim fail
// because it was removed.
export function claimGift(gift: GiftDoc) {
  const meta: ClaimMeta = { gift }
  return submit('gifts.claim', { giftId: gift._id }, { meta })
}

export function unclaimGift(gift: GiftDoc) {
  const meta: ClaimMeta = { gift }
  return submit('gifts.unclaim', { giftId: gift._id }, { meta })
}
