import type { ActivityDoc } from '@prezentowo/types'

import { RECENT_PER_EVENT, findEventActivity } from '@/api/activity'
import { useSubscription, useTracker } from '@/sync'

// Home (`3a`) subscribes once for all its events' recent items.
export function useRecentActivitySubscription(): boolean {
  return useSubscription('activity.recentForUser', [])
}

// One `3a` row's recent items, newest first.
export function useRecentActivity(eventId: string): ActivityDoc[] {
  return useTracker(
    () => findEventActivity(eventId, RECENT_PER_EVENT),
    [eventId],
  )
}
