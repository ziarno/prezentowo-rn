import type { AddGiftArgs, EventDoc, UpdateGiftArgs } from '@prezentowo/types'
import { Match, check } from 'meteor/check'
import { Meteor } from 'meteor/meteor'

import { Events } from '../events/events.collection'
import { Gifts } from './gifts.collection'

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

// Resolves which real user (if any) a participant id belongs to.
const realUserIdForParticipant = (
  event: EventDoc,
  participantId: string,
): string | undefined => {
  const participant = event.participants.find(p => p.id === participantId)
  if (participant && participant.kind === 'real') return participant.userId
  return undefined
}

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
      price: Match.Maybe(String),
      url: Match.Maybe(String),
      image: Match.Maybe(String),
    }),
  )

  if (!this.userId) {
    throw new Meteor.Error('notAuthorized', 'mustBeLoggedIn')
  }

  const event = await assertEventMember(this.userId, options.eventId)

  if (!event.participants.some(p => p.id === options.forParticipantId)) {
    throw new Meteor.Error('notFound', 'participantNotFound')
  }

  const title = options.title.trim()
  if (!title) {
    throw new Meteor.Error('invalidArgs', 'missingTitle')
  }

  const _id = await Gifts.insertAsync({
    eventId: options.eventId,
    forParticipantId: options.forParticipantId,
    title,
    ...(options.description?.trim()
      ? { description: options.description.trim() }
      : {}),
    ...(options.price?.trim() ? { price: options.price.trim() } : {}),
    ...(options.url?.trim() ? { url: options.url.trim() } : {}),
    ...(options.image ? { image: options.image } : {}),
    claimedBy: [],
    createdBy: this.userId,
    createdAt: new Date(),
  } as Parameters<typeof Gifts.insertAsync>[0])

  return { _id }
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
      price: Match.Maybe(String),
      url: Match.Maybe(String),
      image: Match.Maybe(String),
    }),
  )

  if (!this.userId) {
    throw new Meteor.Error('notAuthorized', 'mustBeLoggedIn')
  }

  const gift = await Gifts.findOneAsync(options.giftId)
  if (!gift) {
    throw new Meteor.Error('notFound', 'giftNotFound')
  }
  await assertEventMember(this.userId, gift.eventId)

  const updates: Record<string, unknown> = {}
  if (options.title !== undefined) {
    const title = options.title.trim()
    if (!title) throw new Meteor.Error('invalidArgs', 'missingTitle')
    updates.title = title
  }
  if (options.description !== undefined)
    updates.description = options.description.trim()
  if (options.price !== undefined) updates.price = options.price.trim()
  if (options.url !== undefined) updates.url = options.url.trim()
  if (options.image !== undefined) updates.image = options.image

  if (Object.keys(updates).length > 0) {
    await Gifts.updateAsync(options.giftId, { $set: updates })
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

  const gift = await Gifts.findOneAsync(options.giftId)
  if (!gift) {
    throw new Meteor.Error('notFound', 'giftNotFound')
  }
  await assertEventMember(this.userId, gift.eventId)

  await Gifts.removeAsync(options.giftId)
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
  const gift = await Gifts.findOneAsync(options.giftId)
  if (!gift) {
    throw new Meteor.Error('notFound', 'giftNotFound')
  }
  const event = await assertEventMember(userId, gift.eventId)

  // You can't claim a gift that's on your own wishlist — and you shouldn't be
  // able to see its claim state anyway ("claim quietly").
  if (realUserIdForParticipant(event, gift.forParticipantId) === userId) {
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
