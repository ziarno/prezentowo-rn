import type { EventDoc } from '@prezentowo/types'
import { Meteor } from 'meteor/meteor'

import { Events } from '../events/events.collection'
import { Invites } from './invites.collection'

// The event an invite code opens, or null. An unknown and a rotated code are
// answered the same way, so nobody learns a code once existed.
export async function findEventForCode(code: string): Promise<EventDoc | null> {
  const invite = await Invites.findOneAsync({ code })
  return (invite && (await Events.findOneAsync(invite.eventId))) ?? null
}

// As findEventForCode, for a method: a code that opens nothing is an error.
export async function eventForCode(code: string): Promise<EventDoc> {
  const event = await findEventForCode(code)
  if (!event) {
    throw new Meteor.Error('notFound', 'inviteNotFound')
  }
  return event
}
