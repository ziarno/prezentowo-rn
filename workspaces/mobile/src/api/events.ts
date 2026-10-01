import type {
  CreateEventArgs,
  EventDoc,
  JoinEventArgs,
  JoinEventResult,
  RemoveParticipantArgs,
  UpdateEventArgs,
} from '@prezentowo/types'

import { call, collection } from '@/sync'

export const Events = collection<EventDoc>('events')

export type EventListItem = EventDoc

// The beneficiary's participant id in a many-to-one event, else undefined.
export const beneficiaryIdOf = (event: EventDoc): string | undefined =>
  event.type === 'many-to-one' ? event.beneficiaryParticipantId : undefined

export function findMyEvents(): EventDoc[] {
  return Events.find({}, { sort: { createdAt: -1 } }).fetch()
}

export function findEventById(eventId: string): EventDoc | undefined {
  return Events.findOne(eventId)
}

export function createEvent(args: CreateEventArgs): Promise<{ _id: string }> {
  return call<{ _id: string }>('events.create', args)
}

export function updateEvent(args: UpdateEventArgs): Promise<void> {
  return call('events.update', args)
}

export function joinEvent(args: JoinEventArgs): Promise<JoinEventResult> {
  return call<JoinEventResult>('events.join', args)
}

// `6a`'s remove: the presents for them go too; the ones they added stay.
export function removeParticipant(args: RemoveParticipantArgs): Promise<void> {
  return call('events.removeParticipant', args)
}

// `6a`'s Delete event: everyone loses it, with all its presents.
export function deleteEvent(eventId: string): Promise<void> {
  return call('events.delete', { eventId })
}
