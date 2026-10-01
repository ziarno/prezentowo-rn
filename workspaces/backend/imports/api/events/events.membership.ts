import type { EventDoc } from '@prezentowo/types'
import { Meteor } from 'meteor/meteor'

import { Events } from './events.collection'

// A member is the event's creator or one of its real participants.
export const isMemberOf = (
  event: Pick<EventDoc, 'ownerId' | 'participants'>,
  userId: string,
): boolean =>
  event.ownerId === userId ||
  event.participants.some(p => p.kind === 'real' && p.userId === userId)

// Loads an event only its creator may change, e.g. from `6a`.
export async function loadOwnEvent(
  eventId: string,
  userId: string,
): Promise<EventDoc> {
  const event = await Events.findOneAsync(eventId)
  if (!event) {
    throw new Meteor.Error('notFound', 'eventNotFound')
  }
  if (event.ownerId !== userId) {
    throw new Meteor.Error('notAuthorized', 'notTheEventCreator')
  }
  return event
}
