import Meteor, { type MeteorError, Mongo } from '@meteorrn/core'
import type { CreateEventArgs, EventDoc } from '@prezentowo/types'

export const Events = new Mongo.Collection<EventDoc>('events')

export type EventListItem = EventDoc

export type Subscription = { stop: () => void }

export function subscribeToMyEvents(): Subscription {
  const subId = Meteor.getData().ddp.sub('events.mine', [])
  return { stop: () => Meteor.getData().ddp.unsub(subId) }
}

export function subscribeToEventById(eventId: string): Subscription {
  const subId = Meteor.getData().ddp.sub('events.byId', [eventId])
  return { stop: () => Meteor.getData().ddp.unsub(subId) }
}

export function findMyEvents(): EventDoc[] {
  return Events.find({}, { sort: { createdAt: -1 } }).fetch()
}

export function findEventById(eventId: string): EventDoc | undefined {
  return Events.findOne(eventId)
}

export function createEvent(
  args: CreateEventArgs,
): Promise<{ _id: string }> {
  return new Promise((resolve, reject) => {
    Meteor.call(
      'events.create',
      args,
      (err: MeteorError | undefined, result?: { _id: string }) => {
        if (err) return reject(err)
        resolve(result as { _id: string })
      },
    )
  })
}

export function joinEvent(args: {
  eventId: string
  participantId?: string
}): Promise<void> {
  return new Promise((resolve, reject) => {
    Meteor.call('events.join', args, (err: MeteorError | undefined) => {
      if (err) return reject(err)
      resolve()
    })
  })
}
