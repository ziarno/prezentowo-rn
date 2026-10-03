import { type QueuedWrite, queuedWrites, useTracker } from '@/sync'

// The writes waiting in (or failed out of) the offline queue, in order.
export function useQueuedWrites(): QueuedWrite[] {
  return useTracker(() => queuedWrites())
}
