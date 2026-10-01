import type { EventDoc } from '@prezentowo/types'
import { Meteor, type Subscription } from 'meteor/meteor'

import { Events } from './events.collection'

// A member is the event's creator or one of its real participants.
export const isMemberOf = (
  event: Pick<EventDoc, 'ownerId' | 'participants'>,
  userId: string,
): boolean =>
  event.ownerId === userId ||
  event.participants.some(p => p.kind === 'real' && p.userId === userId)

// Meteor 3 exposes `observeAsync` on cursors, but the bundled type defs lag
// behind — narrow the cursor to the shape we use.
type ObservableEvents = {
  observeAsync: (callbacks: {
    added?: (event: EventDoc) => void
    changed?: (event: EventDoc) => void
    removed?: () => void
  }) => Promise<{ stop: () => void }>
}

/**
 * Gates a members-only publication on membership for as long as it runs, not
 * just at subscribe time. Resolves with the event as first read, or null when
 * `userId` isn't a member (`sub` is left to the caller). Once they stop being
 * one — `events.removeParticipant` — or the event is deleted, `sub` is
 * stopped, which takes everything it published back off their client.
 */
export async function watchMembership(
  sub: Subscription,
  eventId: string,
  userId: string,
): Promise<EventDoc | null> {
  let event = null as EventDoc | null
  const handle = await (
    Events.find({ _id: eventId }) as unknown as ObservableEvents
  ).observeAsync({
    added: doc => void (event = doc),
    changed: doc => {
      if (!isMemberOf(doc, userId)) sub.stop()
    },
    removed: () => sub.stop(),
  })
  if (!event || !isMemberOf(event, userId)) {
    handle.stop()
    return null
  }
  sub.onStop(() => handle.stop())
  return event
}

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
