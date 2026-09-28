import type { AddGiftArgs, GiftDoc, UpdateGiftArgs } from '@prezentowo/types'

import { call, collection } from '@/sync'

export const Gifts = collection<GiftDoc>('gifts')

export function findGiftsByEvent(eventId: string): GiftDoc[] {
  return Gifts.find({ eventId }, { sort: { createdAt: -1 } }).fetch()
}

export function findGiftById(giftId: string): GiftDoc | undefined {
  return Gifts.findOne(giftId)
}

export function addGift(args: AddGiftArgs): Promise<{ _id: string }> {
  return call<{ _id: string }>('gifts.add', args)
}

export function updateGift(args: UpdateGiftArgs): Promise<void> {
  return call('gifts.update', args)
}

export function removeGift(giftId: string): Promise<void> {
  return call('gifts.remove', { giftId })
}

export function claimGift(giftId: string): Promise<void> {
  return call('gifts.claim', { giftId })
}

export function unclaimGift(giftId: string): Promise<void> {
  return call('gifts.unclaim', { giftId })
}
