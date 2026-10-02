import type { NotificationDoc } from '@prezentowo/types'

import { collection } from '@/sync'

export const Notifications = collection<NotificationDoc>('notifications')

// How many of the caller's notifications are unread, as
// `notifications.mine` sends them.
export function countUnread(): number {
  return Notifications.find({ read: false }).fetch().length
}
