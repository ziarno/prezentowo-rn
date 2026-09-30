import type { InviteDoc } from '@prezentowo/types'

import { findInviteForEvent } from '@/api/invites'
import { useSubscription, useTracker } from '@/sync'

// The event's invite. Only its creator is sent one, so for everyone else this
// stays undefined.
export function useEventInvite(eventId: string): InviteDoc | undefined {
  useSubscription('invites.forEvent', [eventId])
  return useTracker(() => findInviteForEvent(eventId), [eventId])
}
