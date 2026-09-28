import type { GiftDoc } from '@prezentowo/types'

import { findGiftsByEvent } from '@/api/gifts'
import { useSubscription, useTracker } from '@/sync'

export function useEventGifts(eventId: string | undefined): {
  gifts: GiftDoc[]
  ready: boolean
} {
  const ready = useSubscription('gifts.byEvent', eventId ? [eventId] : null)
  const gifts = useTracker(
    () => (eventId ? findGiftsByEvent(eventId) : []),
    [eventId],
  )
  return { gifts, ready }
}
