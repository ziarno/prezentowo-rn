import type { ChatThreadDoc } from '@prezentowo/types'

import { collection } from '@/sync'

// The event's live threads the viewer belongs to (`chatThreads.byEvent`).
// Not mirrored: chat is online-only (docs/spec.md §8).
const ChatThreads = collection<ChatThreadDoc>('chatThreads')

export function findChatThreads(eventId: string): ChatThreadDoc[] {
  return ChatThreads.find({ eventId }).fetch()
}
