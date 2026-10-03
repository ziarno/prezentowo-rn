import type { ActivityDoc, EventDoc, GiftDoc } from '@prezentowo/types'

// Pure helpers behind the event feed (`3c`–`3c4`) and Home's recent items
// (`3a`).

type GiftFields = { giftId: string; giftTitle: string }

// What one activity item says, in participant ids for the screen to name.
// Self-added vs suggested is derived from actor vs recipient, never stored.
export type ActivityLine =
  | { kind: 'joined'; actorId: string }
  | ({ kind: 'self-added'; actorId: string } & GiftFields)
  | ({
      kind: 'suggested' | 'claimed' | 'unclaimed'
      actorId: string
      // Left out where it goes without saying: a many-to-one event's
      // beneficiary (`3c` vs `3c2`).
      recipientId?: string
    } & GiftFields)

const LINE_KIND = {
  'gift-added': 'suggested',
  'gift-claimed': 'claimed',
  'gift-unclaimed': 'unclaimed',
} as const

const participantIdOf = (event: EventDoc, userId: string | undefined) =>
  userId
    ? event.participants.find(p => p.kind === 'real' && p.userId === userId)?.id
    : undefined

// What one activity item says to the viewer, or null when it must never reach
// them: a suggestion for them (own-list visibility rule) or any claim on a
// present for them (claim-quietly rule). The publication already withholds
// these; checking again keeps a stale local copy from ever surfacing one. A
// present item missing its present says nothing, so it's dropped too.
export function activityLine(
  event: EventDoc,
  item: ActivityDoc,
  viewerUserId: string | undefined,
): ActivityLine | null {
  const actorId = item.actorParticipantId
  if (item.kind === 'participant-joined') return { kind: 'joined', actorId }

  const { giftId, giftTitle } = item
  if (!giftId || giftTitle === undefined) return null
  const gift = { giftId, giftTitle }
  const recipient = item.recipientParticipantId
  if (item.kind === 'gift-added' && actorId === recipient)
    return { kind: 'self-added', actorId, ...gift }

  const viewerParticipantId = participantIdOf(event, viewerUserId)
  if (viewerParticipantId && recipient === viewerParticipantId) return null

  const kind = LINE_KIND[item.kind]
  const isBeneficiary =
    event.type === 'many-to-one' && recipient === event.beneficiaryParticipantId
  return {
    kind,
    actorId,
    ...(recipient && !isBeneficiary ? { recipientId: recipient } : {}),
    ...gift,
  }
}

// The items the viewer may see, each with what it says, in their order.
export function activityLines(
  event: EventDoc,
  items: ActivityDoc[],
  viewerUserId: string | undefined,
): { item: ActivityDoc; line: ActivityLine }[] {
  return items.flatMap(item => {
    const line = activityLine(event, item, viewerUserId)
    return line ? [{ item, line }] : []
  })
}

// The feed's "X of Y have a buyer", over the presents the viewer can see
// claims on: never their own, whose copies the claim-quietly rule strips.
export function buyerSummary(
  event: EventDoc,
  gifts: GiftDoc[],
  viewerUserId: string | undefined,
): { withBuyer: number; total: number } {
  const viewerParticipantId = participantIdOf(event, viewerUserId)
  const notForViewer = gifts.filter(
    g => g.forParticipantId !== viewerParticipantId,
  )
  return {
    withBuyer: notForViewer.filter(g => (g.claimedBy?.length ?? 0) > 0).length,
    total: notForViewer.length,
  }
}

const MINUTE_MS = 60 * 1000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS

export type TimeAgo =
  | { kind: 'now' | 'yesterday' | 'date' }
  | { kind: 'minute' | 'hour' | 'day'; count: number }

// How long ago an item happened: minutes, then hours within the last day,
// then calendar days up to a week, then just its date.
export function timeAgo(at: Date, now: Date): TimeAgo {
  const elapsed = now.getTime() - at.getTime()
  if (elapsed < MINUTE_MS) return { kind: 'now' }
  if (elapsed < HOUR_MS)
    return { kind: 'minute', count: Math.floor(elapsed / MINUTE_MS) }
  if (elapsed < DAY_MS)
    return { kind: 'hour', count: Math.floor(elapsed / HOUR_MS) }

  // Via UTC, so a DST change in between doesn't leave a 23 or 25 hour day.
  const utcDay = (d: Date) =>
    Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
  const days = Math.round((utcDay(now) - utcDay(at)) / DAY_MS)
  if (days <= 1) return { kind: 'yesterday' }
  if (days < 7) return { kind: 'day', count: days }
  return { kind: 'date' }
}
