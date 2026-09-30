import type { EventDoc } from '@prezentowo/types'
import { Meteor } from 'meteor/meteor'

import { Events } from '../events/events.collection'
import { Invites } from './invites.collection'

// The event an invite code opens. An unknown and a rotated code are answered
// the same way, so nobody learns a code once existed.
export async function eventForCode(code: string): Promise<EventDoc> {
  const invite = await Invites.findOneAsync({ code })
  const event = invite && (await Events.findOneAsync(invite.eventId))
  if (!event) {
    throw new Meteor.Error('notFound', 'inviteNotFound')
  }
  return event
}
