import type { EventDoc, GiftDoc } from '@prezentowo/types'

type GiftParties = Pick<GiftDoc, 'forParticipantId' | 'createdBy'>

// Whether `userId` is the gift's recipient. A placeholder recipient has no
// user, so nobody is ever the recipient of a gift on a placeholder's list.
export const isRecipient = (
  event: EventDoc,
  gift: Pick<GiftDoc, 'forParticipantId'>,
  userId: string,
): boolean =>
  event.participants.some(
    p =>
      p.id === gift.forParticipantId &&
      p.kind === 'real' &&
      p.userId === userId,
  )

// Own-list visibility rule: a gift suggested for `userId` (they're its
// recipient but didn't add it) never reaches them. Leans on recipient and
// creator being write-once, so a gift never moves between visible and hidden.
export const isHiddenFrom = (
  event: EventDoc,
  gift: GiftParties,
  userId: string,
): boolean => gift.createdBy !== userId && isRecipient(event, gift, userId)
