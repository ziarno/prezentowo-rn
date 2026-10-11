import {
  type EventDoc,
  type InboxPushData,
  type NotificationDoc,
  PUSH_KINDS,
} from '@prezentowo/types'
import { Meteor } from 'meteor/meteor'

import { Events } from '../events/events.collection'
import { Notifications } from '../notifications/notifications.collection'
import { type PushMessage, pushClient } from './push.client'
import { PushTokens } from './push.collection'
import { PUSH_COPY } from './push.copy'
import { trackPushTickets } from './push.receipts'

type InboxPushKind = InboxPushData['kind']

// `invite-deferred` and `event-handed-over` never push (docs/spec.md §1.13).
const isInboxPushKind = (kind: string): kind is InboxPushKind =>
  kind !== 'chat' && (PUSH_KINDS as readonly string[]).includes(kind)

// A user's name, or undefined while they have none.
const userName = async (userId: string) =>
  (
    await Meteor.users.findOneAsync(userId, {
      fields: { 'profile.name': 1 },
    })
  )?.profile?.name || undefined

// A participant's name as the inbox shows it, or undefined once they're gone.
const participantName = async (
  event: Pick<EventDoc, 'participants'>,
  participantId: string | undefined,
) => {
  const participant = event.participants.find(p => p.id === participantId)
  if (!participant) return undefined
  if (participant.kind === 'placeholder') return participant.name
  return userName(participant.userId)
}

const actorOf = (notification: NotificationDoc, event: EventDoc) => {
  switch (notification.kind) {
    case 'invited':
      return userName(event.ownerId)
    case 'participant-joined':
      return participantName(event, notification.joinedParticipantId)
    case 'suggestion-claimed':
      return participantName(event, notification.claimedByParticipantId)
    default:
      return undefined
  }
}

// What a push carries for the app to open `notification` by.
const inboxPushData = (
  notification: NotificationDoc,
  kind: InboxPushKind,
): InboxPushData => ({
  notificationId: notification._id,
  kind,
  eventId: notification.eventId,
  ...(notification.giftId && { giftId: notification.giftId }),
  ...(notification.recipientParticipantId && {
    recipientParticipantId: notification.recipientParticipantId,
  }),
})

/**
 * Sends `notification` as an inbox push to each of its recipient's devices,
 * in each device's language, unless its kind never pushes or the recipient
 * turned it off (docs/spec.md §2.5). Call it once the notification is in.
 */
export async function sendInboxPush(notification: NotificationDoc) {
  const client = pushClient()
  const { kind, userId } = notification
  if (!client || !isInboxPushKind(kind)) return

  const user = await Meteor.users.findOneAsync(userId, {
    fields: { pushPreferences: 1 },
  })
  if (!user || user.pushPreferences?.[kind] === false) return
  const tokens = await PushTokens.find({ userId }).fetchAsync()
  if (!tokens.length) return
  // A deleted event takes its notifications with it.
  const event = await Events.findOneAsync(notification.eventId)
  if (!event) return

  const actor = await actorOf(notification, event)
  const badge = await Notifications.find({ userId, read: false }).countAsync()
  const data = inboxPushData(notification, kind)
  const messages = tokens.map((token): PushMessage => {
    const copy = PUSH_COPY[token.locale]
    return {
      to: token.expoToken,
      title: event.title,
      body: copy.body[kind]({
        actor: actor ?? copy.someone,
        gift: notification.giftTitle ?? '',
      }),
      data,
      badge,
      sound: 'default',
    }
  })

  await trackPushTickets(messages, await client.send(messages))
}

const inFlight = new Set<Promise<void>>()

/**
 * Queues `notification`'s push (see `sendInboxPush`) without waiting for it.
 * A failure is logged and never reaches the method that inserted it.
 */
export function queueInboxPush(notification: NotificationDoc) {
  const push: Promise<void> = sendInboxPush(notification)
    .catch(error => console.error('push: an inbox push failed', error))
    .finally(() => inFlight.delete(push))
  inFlight.add(push)
}

/** Resolves once every queued inbox push has been sent or has failed. For tests. */
export async function inboxPushesSettled() {
  while (inFlight.size) await Promise.all(inFlight)
}
