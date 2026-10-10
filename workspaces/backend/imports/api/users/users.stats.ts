import type { EventDoc, UserStats } from '@prezentowo/types'
import { Meteor } from 'meteor/meteor'
import type { Mongo } from 'meteor/mongo'

import { Events } from '../events/events.collection'
import {
  memberEventsSelector,
  participantIdOf,
} from '../events/events.membership'
import { type GiftRecord, Gifts } from '../gifts/gifts.collection'

// Profile's three tiles (docs/spec.md §10.3), counted from what exists now,
// never from stored counters. Online-only; the client keeps the last answer.
const userStats = async function (
  this: Meteor.MethodThisType,
): Promise<UserStats> {
  const userId = this.userId
  if (!userId) {
    throw new Meteor.Error('notAuthorized', 'mustBeLoggedIn')
  }

  const events = (await Events.find(memberEventsSelector(userId), {
    fields: { ownerId: 1, participants: 1 },
  }).fetchAsync()) as Pick<EventDoc, '_id' | 'ownerId' | 'participants'>[]
  if (events.length === 0) return { events: 0, wished: 0, claimed: 0 }

  const eventIds = events.map(event => event._id)
  // Wished: the caller's own gifts for themselves. A suggestion for them is
  // never counted — that would reveal it exists (own-list visibility).
  const wishedClauses = events.flatMap(event => {
    const participantId = participantIdOf(event, userId)
    return participantId
      ? [{ eventId: event._id, forParticipantId: participantId }]
      : []
  })

  const [wished, claimed] = await Promise.all([
    wishedClauses.length === 0
      ? 0
      : Gifts.find({
          createdBy: userId,
          $or: wishedClauses,
        } as Mongo.Selector<GiftRecord>).countAsync(),
    Gifts.find({
      eventId: { $in: eventIds },
      claimedBy: userId,
    } as Mongo.Selector<GiftRecord>).countAsync(),
  ])

  return { events: events.length, wished, claimed }
}

Meteor.methods({ 'users.stats': userStats })
