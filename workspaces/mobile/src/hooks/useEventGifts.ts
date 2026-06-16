import Meteor from '@meteorrn/core'
import type { GiftDoc } from '@prezentowo/types'
import { useEffect } from 'react'

import { findGiftsByEvent, subscribeToEventGifts } from '@/api/gifts'

export function useEventGifts(eventId: string | undefined): GiftDoc[] {
  useEffect(() => {
    if (!eventId) return
    const sub = subscribeToEventGifts(eventId)
    return () => sub.stop()
  }, [eventId])

  return Meteor.useTracker(() =>
    eventId ? findGiftsByEvent(eventId) : ([] as GiftDoc[]),
  )
}
