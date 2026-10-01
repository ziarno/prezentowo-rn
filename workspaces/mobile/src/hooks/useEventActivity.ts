import type { ActivityDoc } from '@prezentowo/types'

import { findEventActivity } from '@/api/activity'
import { useSubscription, useTracker } from '@/sync'

// The event feed's (`3c`) items, newest first.
export function useEventActivity(eventId: string | undefined): {
  items: ActivityDoc[]
  ready: boolean
} {
  const ready = useSubscription('activity.byEvent', eventId ? [eventId] : null)
  const items = useTracker(
    () => (eventId ? findEventActivity(eventId) : []),
    [eventId],
  )
  return { items, ready }
}
