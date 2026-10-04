import type { ChatThreadDoc } from '@prezentowo/types'

// How many messages a recap box shows.
export const RECAP_LENGTH = 3

export const cidOf = (thread: ChatThreadDoc) =>
  `${thread.streamChannelType}:${thread.streamChannelId}`

// `8b`.
export const eventThreadOf = (threads: ChatThreadDoc[]) =>
  threads.find(t => t.kind === 'event')

// `8a`. The viewer's own secret thread is never published, so it's never
// found: the recipient has no way into it.
export const secretThreadOf = (
  threads: ChatThreadDoc[],
  participantId: string,
) =>
  threads.find(
    t => t.kind === 'secret' && t.recipientParticipantId === participantId,
  )

// The parts of a Stream message a recap reads.
export type RecapMessage = {
  id: string
  type?: string
  text?: string
  deleted_at?: string | Date | null
  user?: { id: string } | null
}

export type RecapLine = {
  id: string
  userId: string
  // Null for a message that is only attachments.
  text: string | null
}

// A recap box's lines, oldest first: a channel's last few messages that are
// still there and that someone wrote.
export function recapOf(channel: { messages?: RecapMessage[] }): RecapLine[] {
  return (channel.messages ?? [])
    .filter(m => m.type !== 'deleted' && m.type !== 'system' && !m.deleted_at)
    .slice(-RECAP_LENGTH)
    .map(m => ({
      id: m.id,
      userId: m.user?.id ?? '',
      text: m.text?.trim() ? m.text.trim() : null,
    }))
}
