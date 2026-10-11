import * as Notifications from 'expo-notifications'

import { foregroundBehavior } from './payload'

// The cid of the chat thread on screen, if any.
let chatOnScreen: string | null = null

/**
 * Marks `cid`'s thread as on screen, so its pushes don't show while the app
 * is open (docs/spec.md §10.5). Returns the unmark.
 */
export function showChatOnScreen(cid: string) {
  chatOnScreen = cid
  return () => {
    if (chatOnScreen === cid) chatOnScreen = null
  }
}

Notifications.setNotificationHandler({
  handleNotification: async notification =>
    foregroundBehavior(notification, chatOnScreen),
})
