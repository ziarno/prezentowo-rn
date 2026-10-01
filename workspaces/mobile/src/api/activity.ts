import type { ActivityDoc } from '@prezentowo/types'

import { collection } from '@/sync'

export const Activity = collection<ActivityDoc>('activity')

// How many items Home (`3a`) shows per event, as `activity.recentForUser`
// sends them.
export const RECENT_PER_EVENT = 3

// The event's items, newest first.
export function findEventActivity(
  eventId: string,
  limit?: number,
): ActivityDoc[] {
  return Activity.find(
    { eventId },
    { sort: { createdAt: -1 }, ...(limit ? { limit } : {}) },
  ).fetch()
}
