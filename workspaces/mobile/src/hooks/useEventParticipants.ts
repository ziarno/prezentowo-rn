import Meteor from '@meteorrn/core'
import type { EventDoc } from '@prezentowo/types'
import { useEffect } from 'react'

import {
  type ResolvedParticipant,
  resolveParticipants,
} from '@/api/participants'
import { findUserById, subscribeToEventUsers } from '@/api/users'
import { useCurrentUser } from '@/hooks/useCurrentUser'

export type EventParticipantsResult = {
  participants: ResolvedParticipant[]
  resolve: (participantId: string) => ResolvedParticipant | undefined
}

// Subscribes to the event's participant profiles and returns the participants
// resolved to display names/avatars, plus a lookup by participant id.
export function useEventParticipants(
  event: EventDoc | undefined,
): EventParticipantsResult {
  const user = useCurrentUser()
  const eventId = event?._id

  useEffect(() => {
    if (!eventId) return
    const sub = subscribeToEventUsers(eventId)
    return () => sub.stop()
  }, [eventId])

  const participants = Meteor.useTracker(() => {
    if (!event) return [] as ResolvedParticipant[]
    return resolveParticipants(event, user?._id, findUserById)
  })

  return {
    participants,
    resolve: id => participants.find(p => p.id === id),
  }
}
