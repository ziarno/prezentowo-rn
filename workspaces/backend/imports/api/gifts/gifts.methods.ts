import {
  type AddGiftArgs,
  type EventDoc,
  PRESENT_ILLUSTRATION_IDS,
  type UpdateGiftArgs,
} from '@prezentowo/types'
import { Match, check } from 'meteor/check'
import { Meteor } from 'meteor/meteor'

import { Events } from '../events/events.collection'
import { imageRefPattern } from '../images/images.patterns'
import {
  assertOwnUpload,
  assertStockArt,
  releaseImage,
} from '../images/images.refs'
import { Gifts } from './gifts.collection'
import { isHiddenFrom, isRecipient } from './gifts.visibility'

// Loads the event and asserts the caller is a real participant of it. Returns
// the event so callers can do further participant checks without re-fetching.
const assertEventMember = async function (
  userId: string,
  eventId: string,
): Promise<EventDoc> {
  const event = await Events.findOneAsync(eventId)
  if (!event) {
    throw new Meteor.Error('notFound', 'eventNotFound')
  }
  const isMember =
    event.ownerId === userId ||
    event.participants.some(p => p.kind === 'real' && p.userId === userId)
  if (!isMember) {
    throw new Meteor.Error('notAuthorized', 'notAParticipant')
  }
  return event
}

// Loads a gift the caller may act on: they must be a member of its event, and
// a gift hidden from them by the own-list visibility rule (suggested for them)
// is answered exactly like a missing one, so no method confirms it exists.
const loadGift = async function (userId: string, giftId: string) {
  const gift = await Gifts.findOneAsync(giftId)
  if (!gift) {
    throw new Meteor.Error('notFound', 'giftNotFound')
  }
  const event = await assertEventMember(userId, gift.eventId)
  if (isHiddenFrom(event, gift, userId)) {
    throw new Meteor.Error('notFound', 'giftNotFound')
  }
  return { gift, event }
}

const isDuplicateKeyError = (error: unknown) =>
  (error as { code?: unknown } | null)?.code === 11000

const insertGift = (userId: string, options: AddGiftArgs, title: string) =>
  Gifts.insertAsync({
    eventId: options.eventId,
    forParticipantId: options.forParticipantId,
    title,
    ...(options.description?.trim()
      ? { description: options.description.trim() }
      : {}),
    ...(options.url?.trim() ? { url: options.url.trim() } : {}),
    ...(options.image ? { image: options.image } : {}),
    claimedBy: [],
    createdBy: userId,
    createdAt: new Date(),
    ...(options.clientId ? { clientId: options.clientId } : {}),
  } as Parameters<typeof Gifts.insertAsync>[0])

const addGift = async function (
  this: Meteor.MethodThisType,
  options: AddGiftArgs,
) {
  check(
    options,
    Match.ObjectIncluding({
      eventId: String,
      forParticipantId: String,
      title: String,
      description: Match.Maybe(String),
      url: Match.Maybe(String),
      image: Match.Optional(imageRefPattern),
      clientId: Match.Maybe(String),
    }),
  )

  if (!this.userId) {
    throw new Meteor.Error('notAuthorized', 'mustBeLoggedIn')
  }
  assertStockArt(options.image, PRESENT_ILLUSTRATION_IDS)

  const event = await assertEventMember(this.userId, options.eventId)

  if (!event.participants.some(p => p.id === options.forParticipantId)) {
    throw new Meteor.Error('notFound', 'participantNotFound')
  }

  const title = options.title.trim()
  if (!title) {
    throw new Meteor.Error('invalidArgs', 'missingTitle')
  }

  const userId = this.userId
  const findReplayed = async () =>
    options.clientId
      ? await Gifts.findOneAsync(
          { createdBy: userId, clientId: options.clientId },
          { fields: { _id: 1 } },
        )
      : undefined

  const replayed = await findReplayed()
  if (replayed) return { _id: replayed._id }

  // After the replay check: a replayed add's upload may since have been
  // replaced or cleared, and the replay must still answer with its gift.
  await assertOwnUpload(options.image, userId)

  try {
    return { _id: await insertGift(userId, options, title) }
  } catch (error) {
    // A concurrent replay won the race to the unique (createdBy, clientId)
    // index — return the gift it inserted.
    const winner = isDuplicateKeyError(error) && (await findReplayed())
    if (winner) return { _id: winner._id }
    throw error
  }
}

const updateGift = async function (
  this: Meteor.MethodThisType,
  options: UpdateGiftArgs,
) {
  check(
    options,
    Match.ObjectIncluding({
      giftId: String,
      title: Match.Maybe(String),
      description: Match.Maybe(String),
      url: Match.Maybe(String),
      image: Match.Optional(Match.OneOf(null, imageRefPattern)),
    }),
  )

  if (!this.userId) {
    throw new Meteor.Error('notAuthorized', 'mustBeLoggedIn')
  }

  const { gift } = await loadGift(this.userId, options.giftId)
  if (gift.createdBy !== this.userId) {
    throw new Meteor.Error('notAuthorized', 'notTheGiftCreator')
  }
  assertStockArt(options.image, PRESENT_ILLUSTRATION_IDS)
  await assertOwnUpload(options.image, this.userId)

  const updates: Record<string, unknown> = {}
  if (options.title !== undefined) {
    const title = options.title.trim()
    if (!title) throw new Meteor.Error('invalidArgs', 'missingTitle')
    updates.title = title
  }
  if (options.description !== undefined)
    updates.description = options.description.trim()
  if (options.url !== undefined) updates.url = options.url.trim()
  if (options.image) updates.image = options.image

  const modifier = {
    ...(Object.keys(updates).length > 0 ? { $set: updates } : {}),
    ...(options.image === null ? { $unset: { image: '' } } : {}),
  }
  if (Object.keys(modifier).length > 0) {
    await Gifts.updateAsync(options.giftId, modifier)
  }
  if (options.image !== undefined) {
    await releaseImage(gift.image, options.image)
  }
}

const removeGift = async function (
  this: Meteor.MethodThisType,
  options: { giftId: string },
) {
  check(options, Match.ObjectIncluding({ giftId: String }))

  if (!this.userId) {
    throw new Meteor.Error('notAuthorized', 'mustBeLoggedIn')
  }

  const { gift, event } = await loadGift(this.userId, options.giftId)
  if (gift.createdBy !== this.userId && event.ownerId !== this.userId) {
    throw new Meteor.Error('notAuthorized', 'notTheGiftOrEventCreator')
  }

  await Gifts.removeAsync(options.giftId)
  await releaseImage(gift.image)
}

const setClaim = async function (
  this: Meteor.MethodThisType,
  options: { giftId: string },
  claimed: boolean,
) {
  check(options, Match.ObjectIncluding({ giftId: String }))

  if (!this.userId) {
    throw new Meteor.Error('notAuthorized', 'mustBeLoggedIn')
  }

  const userId = this.userId
  const { gift, event } = await loadGift(userId, options.giftId)

  // You can't claim a gift that's on your own wishlist — and you shouldn't be
  // able to see its claim state anyway ("claim quietly").
  if (isRecipient(event, gift, userId)) {
    throw new Meteor.Error('invalidArgs', 'cannotClaimOwnGift')
  }

  await Gifts.updateAsync(options.giftId, {
    [claimed ? '$addToSet' : '$pull']: { claimedBy: userId },
  })
}

Meteor.methods({
  'gifts.add': addGift,
  'gifts.update': updateGift,
  'gifts.remove': removeGift,
  'gifts.claim': function (options: { giftId: string }) {
    return setClaim.call(this, options, true)
  },
  'gifts.unclaim': function (options: { giftId: string }) {
    return setClaim.call(this, options, false)
  },
})
