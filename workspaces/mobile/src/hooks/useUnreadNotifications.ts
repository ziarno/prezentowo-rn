import { countUnread } from '@/api/notifications'
import { useSubscription, useTracker } from '@/sync'

// Home's (`3a`) bell dot: whether any of our own notifications is unread.
// Never Stream's chat unread count.
export function useHasUnreadNotifications(): boolean {
  useSubscription('notifications.mine', [])
  return useTracker(() => countUnread()) > 0
}
