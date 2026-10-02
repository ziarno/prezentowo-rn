import type { EventDoc, GiftDoc, NotificationDoc } from '@prezentowo/types'

import { isMemberOf, participantIdOf } from '../events/events.membership'
import { isRecipient } from '../gifts/gifts.visibility'
import { Notifications } from './notifications.collection'

type GiftSnapshot = Pick<
  GiftDoc,
  '_id' | 'title' | 'forParticipantId' | 'createdBy'
>

const insert = (item: Omit<NotificationDoc, '_id' | 'createdAt' | 'read'>) =>
  Notifications.insertAsync({
    ...item,
    createdAt: new Date(),
    read: false,
  } as NotificationDoc)

const isDuplicateKeyError = (error: unknown) =>
  (error as { code?: unknown } | null)?.code === 11000

/**
 * `invite-deferred`, for `userId` ignoring `eventId`'s invite. Idempotent: a
 * second ignore keeps the first notification, read or not.
 */
export async function recordInviteDeferred(userId: string, eventId: string) {
  try {
    await Notifications.updateAsync(
      { userId, eventId, kind: 'invite-deferred' },
      {
        $setOnInsert: { createdAt: new Date(), read: false },
      },
      { upsert: true },
    )
  } catch (error) {
    // A concurrent ignore won the race to the unique index.
    if (!isDuplicateKeyError(error)) throw error
  }
}

// Joining makes the deferred invite moot.
export async function clearInviteDeferred(userId: string, eventId: string) {
  await Notifications.removeAsync({ userId, eventId, kind: 'invite-deferred' })
}

/**
 * `suggestion-claimed`, to whoever suggested `gift`. Written only for a
 * suggested gift (its creator isn't its recipient) and never to the claimer
 * themselves; this check is what keeps a self-added gift's claim quiet.
 */
export async function recordSuggestionClaimed(
  event: EventDoc,
  gift: GiftSnapshot,
  claimerId: string,
) {
  const suggested = !isRecipient(event, gift, gift.createdBy)
  if (!suggested || gift.createdBy === claimerId) return
  if (!isMemberOf(event, gift.createdBy)) return
  await insert({
    userId: gift.createdBy,
    kind: 'suggestion-claimed',
    eventId: event._id,
    giftId: gift._id,
    giftTitle: gift.title,
    recipientParticipantId: gift.forParticipantId,
    claimedByParticipantId: participantIdOf(event, claimerId),
  })
}

// `participant-joined`, to the event's creator.
export async function recordParticipantJoined(
  event: EventDoc,
  joinedParticipantId: string,
) {
  await insert({
    userId: event.ownerId,
    kind: 'participant-joined',
    eventId: event._id,
    joinedParticipantId,
  })
}

/**
 * `claimed-gift-removed`, to each claimer of a deleted gift except the one
 * who deleted it. The deleter is deliberately not recorded.
 */
export async function recordClaimedGiftRemoved(
  gift: Pick<GiftDoc, 'eventId' | 'title' | 'claimedBy' | 'forParticipantId'>,
  deleterId: string,
) {
  for (const userId of gift.claimedBy) {
    if (userId === deleterId) continue
    await insert({
      userId,
      kind: 'claimed-gift-removed',
      eventId: gift.eventId,
      giftTitle: gift.title,
      recipientParticipantId: gift.forParticipantId,
    })
  }
}
