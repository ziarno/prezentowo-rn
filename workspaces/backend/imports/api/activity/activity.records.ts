import type { ActivityDoc, EventDoc, GiftDoc } from '@prezentowo/types'
import { Meteor } from 'meteor/meteor'

import { participantIdOf } from '../events/events.membership'
import { isRecipient } from '../gifts/gifts.visibility'
import { Activity } from './activity.collection'

type GiftSnapshot = Pick<
  GiftDoc,
  '_id' | 'title' | 'forParticipantId' | 'createdBy'
>

const actorOf = (event: EventDoc, userId: string) => {
  const actor = participantIdOf(event, userId)
  if (!actor) throw new Meteor.Error('notAuthorized', 'notAParticipant')
  return actor
}

// Feeds sort on `createdAt` alone, here and on the client, and `_id` is random,
// so two items stamped in the same millisecond (a claim and its undo) would
// come back in either order. Stamps are kept strictly increasing instead.
let lastStamp = 0
const nextCreatedAt = () => {
  lastStamp = Math.max(Date.now(), lastStamp + 1)
  return new Date(lastStamp)
}

const insert = (item: Omit<ActivityDoc, '_id' | 'createdAt'>) =>
  Activity.insertAsync({ ...item, createdAt: nextCreatedAt() } as ActivityDoc)

const aboutGift = (gift: GiftSnapshot) => ({
  giftId: gift._id,
  giftTitle: gift.title,
  recipientParticipantId: gift.forParticipantId,
})

/**
 * `gift-added`, by whoever added it. Hidden from the recipient unless they
 * added it themselves (own-list visibility rule) — which also covers a
 * placeholder recipient, for whoever later claims that placeholder: the item
 * is never re-evaluated.
 */
export async function recordGiftAdded(event: EventDoc, gift: GiftSnapshot) {
  const selfAdded = isRecipient(event, gift, gift.createdBy)
  await insert({
    ...aboutGift(gift),
    eventId: event._id,
    kind: 'gift-added',
    actorParticipantId: actorOf(event, gift.createdBy),
    ...(selfAdded ? {} : { hiddenFromParticipantId: gift.forParticipantId }),
  })
}

/**
 * `gift-claimed`, by the claimer. Always hidden from the recipient, self-added
 * gift or not (claim-quietly rule).
 */
export async function recordGiftClaimed(
  event: EventDoc,
  gift: GiftSnapshot,
  claimerId: string,
) {
  await insert({
    ...aboutGift(gift),
    eventId: event._id,
    kind: 'gift-claimed',
    actorParticipantId: actorOf(event, claimerId),
    hiddenFromParticipantId: gift.forParticipantId,
  })
}

/**
 * `gift-unclaimed`, by whoever stopped buying it. Hidden from the recipient
 * like the claim it follows.
 */
export async function recordGiftUnclaimed(
  event: EventDoc,
  gift: GiftSnapshot,
  claimerId: string,
) {
  await insert({
    ...aboutGift(gift),
    eventId: event._id,
    kind: 'gift-unclaimed',
    actorParticipantId: actorOf(event, claimerId),
    hiddenFromParticipantId: gift.forParticipantId,
  })
}

// `participant-joined`, by the participant who joined. Visible to everyone.
export async function recordParticipantJoined(
  eventId: string,
  participantId: string,
) {
  await insert({
    eventId,
    kind: 'participant-joined',
    actorParticipantId: participantId,
  })
}
