import type { EventDoc } from '@prezentowo/types'

import { findEventById } from '@/api/events'
import { useSubscription, useTracker } from '@/sync'

export function useEventById(eventId: string | undefined): {
  event: EventDoc | undefined
  ready: boolean
} {
  const ready = useSubscription('events.byId', eventId ? [eventId] : null)
  const event = useTracker(
    () => (eventId ? findEventById(eventId) : undefined),
    [eventId],
  )
  return { event, ready }
}
