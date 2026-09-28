import type { GiftDoc } from '@prezentowo/types'

import { findGiftById } from '@/api/gifts'
import { useSubscription, useTracker } from '@/sync'

// Subscribes via the event's gift list (which enforces the recipient-secrecy
// rule), then picks out the single gift. `eventId` is required to open the
// subscription — gift-detail navigation always carries it.
export function useGiftById(
  giftId: string | undefined,
  eventId: string | undefined,
): { gift: GiftDoc | undefined; ready: boolean } {
  const ready = useSubscription('gifts.byEvent', eventId ? [eventId] : null)
  const gift = useTracker(
    () => (giftId ? findGiftById(giftId) : undefined),
    [giftId],
  )
  return { gift, ready }
}
