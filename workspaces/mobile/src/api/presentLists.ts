import type { EventDoc, GiftDoc } from '@prezentowo/types'

const userIdOf = (event: EventDoc, participantId: string) => {
  const participant = event.participants.find(p => p.id === participantId)
  return participant?.kind === 'real' ? participant.userId : undefined
}

const isRecipient = (
  event: EventDoc,
  gift: GiftDoc,
  viewerUserId: string | undefined,
) => !!viewerUserId && userIdOf(event, gift.forParticipantId) === viewerUserId

// Own-list visibility rule: a gift suggested for the viewer never shows. The
// publication already withholds these; checking again keeps a stale local
// copy from ever surfacing one.
export const isHiddenFrom = (
  event: EventDoc,
  gift: GiftDoc,
  viewerUserId: string | undefined,
): boolean =>
  isRecipient(event, gift, viewerUserId) && gift.createdBy !== viewerUserId

// A person's presents as the viewer may see them.
// - `mine` (`3e`): the viewer's own list, only the gifts they added
//   themselves, shown without claim state.
// - `theirs` (`3f`): anyone else's list, split into the recipient's
//   self-added gifts and the gifts others suggested.
export type PersonPresents =
  | { kind: 'mine'; gifts: GiftDoc[] }
  | { kind: 'theirs'; ownWishes: GiftDoc[]; suggested: GiftDoc[] }

export function personPresents(
  event: EventDoc,
  participantId: string,
  gifts: GiftDoc[],
  viewerUserId: string | undefined,
): PersonPresents {
  const recipientUserId = userIdOf(event, participantId)
  const theirGifts = gifts.filter(
    g =>
      g.forParticipantId === participantId &&
      !isHiddenFrom(event, g, viewerUserId),
  )
  const ownWishes = theirGifts.filter(g => g.createdBy === recipientUserId)

  if (recipientUserId && recipientUserId === viewerUserId) {
    return { kind: 'mine', gifts: ownWishes }
  }
  return {
    kind: 'theirs',
    ownWishes,
    suggested: theirGifts.filter(g => g.createdBy !== recipientUserId),
  }
}

// The 1e call to action for the viewer, or null for the recipient: they may
// not claim their own presents, and never see whether anyone has.
export type ClaimAction = 'claim' | 'claimToo' | 'unclaim'

export function claimAction(
  event: EventDoc,
  gift: GiftDoc,
  viewerUserId: string | undefined,
): ClaimAction | null {
  if (!viewerUserId || isRecipient(event, gift, viewerUserId)) return null
  const claimedBy = gift.claimedBy ?? []
  if (claimedBy.includes(viewerUserId)) return 'unclaim'
  return claimedBy.length > 0 ? 'claimToo' : 'claim'
}

// How many presents the viewer can see for each participant, by participant
// id (`3d`). The viewer's own count is only what they added themselves.
export function presentCounts(
  event: EventDoc,
  gifts: GiftDoc[],
  viewerUserId: string | undefined,
): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const p of event.participants) counts[p.id] = 0
  for (const g of gifts) {
    if (g.forParticipantId in counts && !isHiddenFrom(event, g, viewerUserId))
      counts[g.forParticipantId] += 1
  }
  return counts
}

// `1e` ✎ Edit: only the person who added the present (`gifts.update`).
export const canEditGift = (
  gift: GiftDoc,
  viewerUserId: string | undefined,
): boolean => !!viewerUserId && gift.createdBy === viewerUserId

// `1e` delete: the person who added it or the event creator
// (`gifts.remove`), never for a present hidden from the viewer.
export const canRemoveGift = (
  event: EventDoc,
  gift: GiftDoc,
  viewerUserId: string | undefined,
): boolean =>
  !!viewerUserId &&
  (gift.createdBy === viewerUserId || event.ownerId === viewerUserId) &&
  !isHiddenFrom(event, gift, viewerUserId)

// The "N people claimed this" warning on the delete dialog, or null when
// there is nothing to warn about. A copy without `claimedBy` (the claim-
// quietly rule stripped it) never gets one.
export function claimCountForRemoval(gift: GiftDoc): number | null {
  const count = gift.claimedBy?.length ?? 0
  return count > 0 ? count : null
}
