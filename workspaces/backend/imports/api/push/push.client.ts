import {
  Expo,
  type ExpoPushMessage,
  type ExpoPushReceipt,
  type ExpoPushTicket,
} from 'expo-server-sdk'
import { Meteor } from 'meteor/meteor'

export type PushMessage = ExpoPushMessage & { to: string }

/**
 * The slice of Expo Push Service that inbox pushes use (docs/spec.md §2.5).
 * Kept close to `expo-server-sdk`, so tests can check what reaches Expo.
 */
export interface PushClient {
  // One ticket per message, in order.
  send(messages: PushMessage[]): Promise<ExpoPushTicket[]>
  // Receipts by ticket id; one that isn't ready yet is missing.
  receipts(ticketIds: string[]): Promise<Record<string, ExpoPushReceipt>>
}

export const expoPushClient = (accessToken?: string): PushClient => {
  const expo = new Expo(accessToken ? { accessToken } : {})
  return {
    send: async messages => {
      const tickets: ExpoPushTicket[] = []
      for (const chunk of expo.chunkPushNotifications(messages)) {
        tickets.push(...(await expo.sendPushNotificationsAsync(chunk)))
      }
      return tickets
    },
    receipts: async ticketIds => {
      const receipts: Record<string, ExpoPushReceipt> = {}
      for (const chunk of expo.chunkPushNotificationReceiptIds(ticketIds)) {
        Object.assign(
          receipts,
          await expo.getPushNotificationReceiptsAsync(chunk),
        )
      }
      return receipts
    },
  }
}

// Tests install their own; they never reach Expo. The access token is only
// needed once the Expo project turns on enhanced push security.
const fromEnvironment = (): PushClient | null =>
  Meteor.isTest || Meteor.isAppTest
    ? null
    : expoPushClient(process.env.EXPO_ACCESS_TOKEN)

let client: PushClient | null | undefined

/** The Expo push client, or null when push is off. */
export function pushClient(): PushClient | null {
  if (client === undefined) client = fromEnvironment()
  return client
}

/** Replaces the Expo client, e.g. with a test stub; null turns push off. */
export function setPushClient(next: PushClient | null) {
  client = next
}
