import type { CreateEventArgs, EventDoc } from '@prezentowo/types'

import { call, collection } from '@/sync'

export const Events = collection<EventDoc>('events')

export type EventListItem = EventDoc

export function findMyEvents(): EventDoc[] {
  return Events.find({}, { sort: { createdAt: -1 } }).fetch()
}

export function findEventById(eventId: string): EventDoc | undefined {
  return Events.findOne(eventId)
}

export function createEvent(args: CreateEventArgs): Promise<{ _id: string }> {
  return call<{ _id: string }>('events.create', args)
}

export function joinEvent(args: {
  eventId: string
  participantId?: string
}): Promise<void> {
  return call('events.join', args)
}
