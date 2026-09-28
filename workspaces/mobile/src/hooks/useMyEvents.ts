import { type EventListItem, findMyEvents } from '@/api/events'
import { useSubscription, useTracker } from '@/sync'

// `ready` is false until the list has arrived, including after every
// reconnect — show a loading state, not an empty list, while it is.
export function useMyEvents(): { events: EventListItem[]; ready: boolean } {
  const ready = useSubscription('events.mine', [])
  const events = useTracker(() => findMyEvents())
  return { events, ready }
}
