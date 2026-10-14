import type { ActivityDoc } from '@prezentowo/types'

import { collection } from '@/sync'

export const Activity = collection<ActivityDoc>('activity')

// The event's items, newest first.
export function findEventActivity(eventId: string): ActivityDoc[] {
  return Activity.find({ eventId }, { sort: { createdAt: -1 } }).fetch()
}
