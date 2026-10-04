import type { ChatThreadDoc } from '@prezentowo/types'

import { findChatThreads } from '@/api/chatThreads'
import { useSubscription, useTracker } from '@/sync'

// Chat only ever opens the threads published here (docs/spec.md §7).
export function useChatThreads(eventId: string): {
  threads: ChatThreadDoc[]
  ready: boolean
} {
  const ready = useSubscription('chatThreads.byEvent', [eventId])
  const threads = useTracker(() => findChatThreads(eventId), [eventId])
  return { threads, ready }
}
