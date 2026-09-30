import type { EventDoc } from '@prezentowo/types'

// A member is the event's creator or one of its real participants.
export const isMemberOf = (
  event: Pick<EventDoc, 'ownerId' | 'participants'>,
  userId: string,
): boolean =>
  event.ownerId === userId ||
  event.participants.some(p => p.kind === 'real' && p.userId === userId)
