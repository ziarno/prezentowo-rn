import Meteor from '@meteorrn/core'
import type { GiftDoc } from '@prezentowo/types'
import { useEffect } from 'react'

import { findGiftById, subscribeToEventGifts } from '@/api/gifts'

// Subscribes via the event's gift list (which enforces the recipient-secrecy
// rule), then picks out the single gift. `eventId` is required to open the
// subscription — gift-detail navigation always carries it.
export function useGiftById(
  giftId: string | undefined,
  eventId: string | undefined,
): GiftDoc | undefined {
  useEffect(() => {
    if (!eventId) return
    const sub = subscribeToEventGifts(eventId)
    return () => sub.stop()
  }, [eventId])

  return Meteor.useTracker(() => (giftId ? findGiftById(giftId) : undefined))
}
