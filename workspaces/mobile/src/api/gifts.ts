import Meteor, { type MeteorError, Mongo } from '@meteorrn/core'
import type { AddGiftArgs, GiftDoc, UpdateGiftArgs } from '@prezentowo/types'

import type { Subscription } from './events'

export const Gifts = new Mongo.Collection<GiftDoc>('gifts')

export function subscribeToEventGifts(eventId: string): Subscription {
  const subId = Meteor.getData().ddp.sub('gifts.byEvent', [eventId])
  return { stop: () => Meteor.getData().ddp.unsub(subId) }
}

export function findGiftsByEvent(eventId: string): GiftDoc[] {
  return Gifts.find({ eventId }, { sort: { createdAt: -1 } }).fetch()
}

export function findGiftById(giftId: string): GiftDoc | undefined {
  return Gifts.findOne(giftId)
}

function callAsync<T = void>(method: string, args: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    Meteor.call(method, args, (err: MeteorError | undefined, result?: T) => {
      if (err) return reject(err)
      resolve(result as T)
    })
  })
}

export function addGift(args: AddGiftArgs): Promise<{ _id: string }> {
  return callAsync<{ _id: string }>('gifts.add', args)
}

export function updateGift(args: UpdateGiftArgs): Promise<void> {
  return callAsync('gifts.update', args)
}

export function removeGift(giftId: string): Promise<void> {
  return callAsync('gifts.remove', { giftId })
}

export function claimGift(giftId: string): Promise<void> {
  return callAsync('gifts.claim', { giftId })
}

export function unclaimGift(giftId: string): Promise<void> {
  return callAsync('gifts.unclaim', { giftId })
}
