import Meteor from '@meteorrn/core'
import type { EventDoc } from '@prezentowo/types'
import { useEffect } from 'react'

import { findEventById, subscribeToEventById } from '@/api/events'

export function useEventById(eventId: string | undefined): EventDoc | undefined {
  useEffect(() => {
    if (!eventId) return
    const sub = subscribeToEventById(eventId)
    return () => sub.stop()
  }, [eventId])

  return Meteor.useTracker(() =>
    eventId ? findEventById(eventId) : undefined,
  )
}
