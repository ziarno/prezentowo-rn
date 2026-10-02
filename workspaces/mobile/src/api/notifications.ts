import type { DeferredInvite, NotificationDoc } from '@prezentowo/types'

import { call, collection } from '@/sync'

export const Notifications = collection<NotificationDoc>('notifications')

// Client-only: `invites.deferred` publishes one per set-aside invite, keyed by
// its event.
const DeferredInvites = collection<DeferredInvite & { _id: string }>(
  'deferredInvites',
)

// How many of the caller's notifications are unread, as
// `notifications.mine` sends them. Filtered here rather than by a
// `{ read: false }` selector: the library only re-runs a reactive find when
// the changed doc matches its selector afterwards, so a doc turning read
// would never clear the count.
export function countUnread(): number {
  return Notifications.find({})
    .fetch()
    .filter(n => !n.read).length
}

// The caller's notifications, newest first.
export function findMyNotifications(): NotificationDoc[] {
  return Notifications.find({}, { sort: { createdAt: -1 } }).fetch()
}

export function findDeferredInvite(
  eventId: string,
): DeferredInvite | undefined {
  return DeferredInvites.findOne(eventId)
}

export function markAllNotificationsRead(): Promise<void> {
  return call('notifications.markAllRead')
}
