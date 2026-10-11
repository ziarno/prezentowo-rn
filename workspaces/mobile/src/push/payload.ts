import {
  type ChatThreadDoc,
  type InboxPushData,
  PUSH_KINDS,
} from '@prezentowo/types'

import {
  type NotificationTarget,
  isInvite,
  notificationTarget,
} from '@/api/notificationInbox'
import { cidOf } from '@/chat/threads'

// Pure helpers behind opening and showing pushes (docs/spec.md §10.5). They
// read expo-notifications' objects structurally, so Node tests can make them.

// The parts of an expo-notifications `Notification` read here.
export type PushNotification = {
  request: {
    identifier: string
    content: { data?: Record<string, unknown> | null }
    trigger: unknown
  }
}

// The parts of a `NotificationResponse` read here.
export type PushResponse = {
  notification: PushNotification
  actionIdentifier: string
}

// `Notifications.DEFAULT_ACTION_IDENTIFIER`: the push itself was tapped.
export const DEFAULT_ACTION = 'expo.modules.notifications.actions.DEFAULT'

export type Push =
  // Our server's, through Expo: mirrors one inbox notification.
  | { kind: 'inbox'; data: InboxPushData }
  // Stream's, for a new message in a thread.
  | { kind: 'chat'; eventId: string; cid: string }

const INBOX_KINDS: readonly string[] = PUSH_KINDS.filter(k => k !== 'chat')

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const nonEmpty = (value: unknown) =>
  typeof value === 'string' && value ? value : undefined

// Stream's payload: under `stream` in the APNs payload on iOS, the FCM
// message's flat data on Android.
function streamPayloadOf(notification: PushNotification) {
  const { trigger } = notification.request
  if (!isRecord(trigger) || trigger.type !== 'push') return null
  const candidates = [
    isRecord(trigger.payload) ? trigger.payload.stream : undefined,
    isRecord(trigger.remoteMessage) ? trigger.remoteMessage.data : undefined,
  ]
  return (
    candidates.find(
      (c): c is Record<string, unknown> =>
        isRecord(c) && c.sender === 'stream.chat',
    ) ?? null
  )
}

/** What a push is about, or null for one this app didn't send. */
export function pushOf(notification: PushNotification): Push | null {
  const stream = streamPayloadOf(notification)
  if (stream) {
    const eventId = nonEmpty(stream.eventId)
    const cid = nonEmpty(stream.cid)
    return eventId && cid ? { kind: 'chat', eventId, cid } : null
  }

  const data = notification.request.content.data
  if (!isRecord(data)) return null
  const notificationId = nonEmpty(data.notificationId)
  const eventId = nonEmpty(data.eventId)
  const kind = nonEmpty(data.kind)
  if (!notificationId || !eventId || !kind || !INBOX_KINDS.includes(kind)) {
    return null
  }
  const giftId = nonEmpty(data.giftId)
  const recipientParticipantId = nonEmpty(data.recipientParticipantId)
  return {
    kind: 'inbox',
    data: {
      notificationId,
      kind: kind as InboxPushData['kind'],
      eventId,
      ...(giftId && { giftId }),
      ...(recipientParticipantId && { recipientParticipantId }),
    },
  }
}

/**
 * The taps still to open. Each push opens once, though a cold start reports
 * its tap twice, and an inbox notification opens once, though delivery is
 * at-least-once.
 */
export function createTappedPushes() {
  const seen = new Set<string>()
  return {
    take(response: PushResponse): Push | null {
      if (response.actionIdentifier !== DEFAULT_ACTION) return null
      const push = pushOf(response.notification)
      if (!push) return null
      const keys = [`push:${response.notification.request.identifier}`]
      if (push.kind === 'inbox') {
        keys.push(`notification:${push.data.notificationId}`)
      }
      if (keys.some(key => seen.has(key))) return null
      for (const key of keys) seen.add(key)
      return push
    },
  }
}

/**
 * The screen an inbox push opens: its inbox row's (docs/spec.md §5), or null
 * when that row couldn't open anything either.
 */
export function inboxPushTarget(
  data: InboxPushData,
  context: {
    // The viewer still has the event: the inbox hides a row whose event is
    // gone.
    eventKnown: boolean
    inviteCode?: string
    giftGone: boolean
    recipientInEvent: boolean
  },
): NotificationTarget | null {
  if (!isInvite(data) && !context.eventKnown) return null
  return notificationTarget(data, context)
}

// A publication and its params.
export type Publication = [name: string, params: unknown[]]

/**
 * The publications a push's screen is chosen from: the event's threads for a
 * chat push; for an inbox push, what its inbox row's routing reads.
 */
export function publicationsFor(push: Push): Publication[] {
  if (push.kind === 'chat') return [['chatThreads.byEvent', [push.eventId]]]
  switch (push.data.kind) {
    case 'invited':
      return [['invites.deferred', []]]
    case 'suggestion-claimed':
      return [
        ['events.mine', []],
        ['gifts.byEvent', [push.data.eventId]],
      ]
    default:
      return [['events.mine', []]]
  }
}

export type ChatPushTarget =
  | { pathname: '/event/[eventId]/chat'; params: { eventId: string } }
  | {
      pathname: '/event/[eventId]/person/[participantId]/chat'
      params: { eventId: string; participantId: string }
    }

/**
 * The chat screen a chat push opens: its thread among the ones
 * `chatThreads.byEvent` publishes (docs/spec.md §7), or null when the viewer
 * has no such thread (any more).
 */
export function chatPushTarget(
  push: Extract<Push, { kind: 'chat' }>,
  threads: ChatThreadDoc[],
): ChatPushTarget | null {
  const thread = threads.find(t => cidOf(t) === push.cid)
  if (!thread) return null
  const { eventId } = push
  if (thread.kind === 'event') {
    return { pathname: '/event/[eventId]/chat', params: { eventId } }
  }
  return thread.recipientParticipantId
    ? {
        pathname: '/event/[eventId]/person/[participantId]/chat',
        params: { eventId, participantId: thread.recipientParticipantId },
      }
    : null
}

// The parts of a `NotificationBehavior` set here.
export type PushBehavior = {
  shouldShowBanner: boolean
  shouldShowList: boolean
  shouldPlaySound: boolean
  shouldSetBadge: boolean
}

/**
 * How a push that arrives while the app is open shows: an inbox push not at
 * all, since the bell updates live; a chat push unless its thread is the one
 * on screen. The badge is left to the bell.
 */
export function foregroundBehavior(
  notification: PushNotification,
  chatOnScreen: string | null,
): PushBehavior {
  const push = pushOf(notification)
  const show =
    push === null || (push.kind === 'chat' && push.cid !== chatOnScreen)
  return {
    shouldShowBanner: show,
    shouldShowList: show,
    shouldPlaySound: show,
    shouldSetBadge: false,
  }
}
