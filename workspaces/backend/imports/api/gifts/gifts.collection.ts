import type { GiftDoc } from '@prezentowo/types'
import { Meteor } from 'meteor/meteor'
import { Mongo } from 'meteor/mongo'

// A stored gift. `clientId` is the offline-replay key from `gifts.add`; it's
// server-only, never published (see gifts.byEvent).
export type GiftRecord = GiftDoc & { clientId?: string }

export const Gifts = new Mongo.Collection<GiftRecord>('gifts')

export async function createGiftIndexes() {
  await Gifts.createIndexAsync({ eventId: 1 })
  // Partial rather than sparse: a sparse compound index still indexes every
  // gift (createdBy is always set), so it would reject a user's second gift
  // added without a clientId.
  await Gifts.createIndexAsync(
    { createdBy: 1, clientId: 1 },
    { unique: true, partialFilterExpression: { clientId: { $exists: true } } },
  )
}

Meteor.startup(createGiftIndexes)
