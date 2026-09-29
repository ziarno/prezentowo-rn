import { findEventById } from '@/api/events'
import {
  type ResolvedParticipant,
  resolveParticipants,
} from '@/api/participants'
import { findUserById, getCurrentUser } from '@/api/users'
import { useSubscription, useTracker } from '@/sync'

export type EventParticipantsResult = {
  participants: ResolvedParticipant[]
  resolve: (participantId: string) => ResolvedParticipant | undefined
  // The participant a real user is, e.g. to name a gift's creator or buyers.
  resolveUser: (userId: string) => ResolvedParticipant | undefined
  // Whether the participants' profiles have arrived.
  ready: boolean
}

// Subscribes to the event's participant profiles and returns the participants
// resolved to display names/avatars, plus a lookup by participant id.
export function useEventParticipants(
  eventId: string | undefined,
): EventParticipantsResult {
  const ready = useSubscription('users.inEvent', eventId ? [eventId] : null)

  const participants = useTracker(() => {
    const event = eventId ? findEventById(eventId) : undefined
    if (!event) return [] as ResolvedParticipant[]
    return resolveParticipants(event, getCurrentUser()?._id, findUserById)
  }, [eventId])

  return {
    participants,
    resolve: id => participants.find(p => p.id === id),
    resolveUser: userId => participants.find(p => p.userId === userId),
    ready,
  }
}
