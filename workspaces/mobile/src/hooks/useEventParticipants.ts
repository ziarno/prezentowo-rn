import Meteor from '@meteorrn/core'
import { useEffect } from 'react'

import { findEventById } from '@/api/events'
import {
  type ResolvedParticipant,
  resolveParticipants,
} from '@/api/participants'
import {
  findUserById,
  getCurrentUser,
  subscribeToEventUsers,
} from '@/api/users'

export type EventParticipantsResult = {
  participants: ResolvedParticipant[]
  resolve: (participantId: string) => ResolvedParticipant | undefined
}

// Subscribes to the event's participant profiles and returns the participants
// resolved to display names/avatars, plus a lookup by participant id.
//
// `Meteor.useTracker` keeps the closure from its first render (no deps), so
// everything that changes is read reactively inside it; only `eventId` is
// captured, and callers remount (`key={eventId}`) to switch events.
export function useEventParticipants(
  eventId: string | undefined,
): EventParticipantsResult {
  useEffect(() => {
    if (!eventId) return
    const sub = subscribeToEventUsers(eventId)
    return () => sub.stop()
  }, [eventId])

  const participants = Meteor.useTracker(() => {
    const event = eventId ? findEventById(eventId) : undefined
    if (!event) return [] as ResolvedParticipant[]
    return resolveParticipants(event, getCurrentUser()?._id, findUserById)
  })

  return {
    participants,
    resolve: id => participants.find(p => p.id === id),
  }
}
