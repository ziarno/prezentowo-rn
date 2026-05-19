import Meteor from '@meteorrn/core'
import { useEffect } from 'react'

import {
  type EventListItem,
  findMyEvents,
  subscribeToMyEvents,
} from '@/api/events'

export function useMyEvents(): EventListItem[] {
  useEffect(() => {
    const sub = subscribeToMyEvents()
    return () => sub.stop()
  }, [])

  return Meteor.useTracker(() => findMyEvents())
}
