import type { NotificationDoc } from '@prezentowo/types'

import { timeAgo } from './activityFeed'

// Pure helpers behind the notifications screen (#28's flat inbox).

// An invitation waiting in the inbox, set aside with Ignore or sent from
// `4d`: the viewer isn't in its event, so it opens `7a`.
export const isInvite = (notification: NotificationDoc) =>
  notification.kind === 'invite-deferred' || notification.kind === 'invited'

export type InboxRow =
  | { kind: 'single'; notification: NotificationDoc; isNew: boolean }
  // Two or more `participant-joined` for one event, newest first.
  | {
      kind: 'joins'
      eventId: string
      joins: NotificationDoc[]
      isNew: boolean
    }

export type InboxSection = {
  key: 'new' | 'week' | 'older'
  rows: InboxRow[]
}

const DAY_MS = 24 * 60 * 60 * 1000
const WEEK_MS = 7 * DAY_MS

/**
 * The inbox, newest first: rows unread when the screen opened in New, the
 * rest split at a week old. Within a section, every join for the same event
 * merges into one row at the newest join's place. Empty sections are left
 * out.
 */
export function inboxSections(
  notifications: NotificationDoc[],
  wasUnread: (notification: NotificationDoc) => boolean,
  now: Date,
): InboxSection[] {
  const newestFirst = [...notifications].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  )
  const sectionOf = (n: NotificationDoc): InboxSection['key'] => {
    if (wasUnread(n)) return 'new'
    return now.getTime() - n.createdAt.getTime() < WEEK_MS ? 'week' : 'older'
  }

  const sections: InboxSection[] = [
    { key: 'new', rows: [] },
    { key: 'week', rows: [] },
    { key: 'older', rows: [] },
  ]
  for (const notification of newestFirst) {
    const key = sectionOf(notification)
    const rows = sections.find(s => s.key === key)!.rows
    const isNew = key === 'new'
    if (notification.kind !== 'participant-joined') {
      rows.push({ kind: 'single', notification, isNew })
      continue
    }
    const index = rows.findIndex(
      row =>
        (row.kind === 'joins' ||
          row.notification.kind === 'participant-joined') &&
        eventOf(row) === notification.eventId,
    )
    const row = rows[index]
    if (!row) rows.push({ kind: 'single', notification, isNew })
    else if (row.kind === 'joins') row.joins.push(notification)
    else
      rows[index] = {
        kind: 'joins',
        eventId: notification.eventId,
        joins: [row.notification, notification],
        isNew,
      }
  }
  return sections.filter(s => s.rows.length > 0)
}

const eventOf = (row: InboxRow) =>
  row.kind === 'joins' ? row.eventId : row.notification.eventId

export type InboxTime =
  | { kind: 'now' | 'yesterday' }
  | { kind: 'hour' | 'day' | 'week'; count: number }

// A row's time: "Just now" within the hour, then hours, "Yesterday", days,
// and weeks from a week on.
export function inboxTime(at: Date, now: Date): InboxTime {
  const ago = timeAgo(at, now)
  switch (ago.kind) {
    case 'now':
    case 'minute':
      return { kind: 'now' }
    case 'date': {
      const elapsed = now.getTime() - at.getTime()
      return { kind: 'week', count: Math.max(1, Math.round(elapsed / WEEK_MS)) }
    }
    default:
      return ago as InboxTime
  }
}

export type NotificationTarget =
  | { pathname: '/e/[code]'; params: { code: string } }
  | { pathname: '/event/[eventId]'; params: { eventId: string } }
  | {
      pathname: '/event/[eventId]/gift/[giftId]'
      params: { eventId: string; giftId: string }
    }
  | {
      pathname: '/event/[eventId]/person/[participantId]'
      params: { eventId: string; participantId: string }
    }

/**
 * Where tapping a row goes (docs/spec.md §5), or null while it can't go
 * anywhere yet. A present that's gone opens its recipient's list instead,
 * and the event's feed once the recipient is gone too.
 */
export function notificationTarget(
  notification: NotificationDoc,
  context: {
    // The event's current invite code, for `invite-deferred` and `invited`.
    inviteCode?: string
    // Known to be deleted, not merely not loaded yet.
    giftGone: boolean
    recipientInEvent: boolean
  },
): NotificationTarget | null {
  const { eventId, giftId, recipientParticipantId } = notification
  const feed = { pathname: '/event/[eventId]', params: { eventId } } as const
  const recipientList =
    recipientParticipantId && context.recipientInEvent
      ? ({
          pathname: '/event/[eventId]/person/[participantId]',
          params: { eventId, participantId: recipientParticipantId },
        } as const)
      : feed

  switch (notification.kind) {
    case 'invite-deferred':
    case 'invited':
      return context.inviteCode
        ? { pathname: '/e/[code]', params: { code: context.inviteCode } }
        : null
    case 'suggestion-claimed':
      return giftId && !context.giftGone
        ? {
            pathname: '/event/[eventId]/gift/[giftId]',
            params: { eventId, giftId },
          }
        : recipientList
    case 'claimed-gift-removed':
      return recipientList
    case 'participant-joined':
    case 'event-handed-over':
      return feed
  }
}
