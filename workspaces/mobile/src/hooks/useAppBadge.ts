import { setBadgeCountAsync } from 'expo-notifications'
import { useEffect } from 'react'
import { Platform } from 'react-native'

import { countUnread } from '@/api/notifications'
import { useSubscription, useTracker } from '@/sync'

// Android's launcher keeps its own count (docs/spec.md §10.5).
const setBadge = (count: number) => {
  if (Platform.OS === 'ios') setBadgeCountAsync(count).catch(() => {})
}

// The iOS app-icon badge follows the bell while the app is open: the inbox's
// unread count, never chat's (docs/spec.md §10.5). The server sets it with
// each push otherwise. Cleared when the signed-in app closes (sign-out).
export function useAppBadge() {
  const ready = useSubscription('notifications.mine', [])
  const unread = useTracker(() => countUnread())

  useEffect(() => {
    if (ready) setBadge(unread)
  }, [ready, unread])

  useEffect(() => () => setBadge(0), [])
}
