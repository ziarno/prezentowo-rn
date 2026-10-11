import type { ExpoPushReceipt, ExpoPushTicket } from 'expo-server-sdk'
import { Meteor } from 'meteor/meteor'
import { Mongo } from 'meteor/mongo'

import { type PushMessage, pushClient } from './push.client'
import { PushTokens } from './push.collection'
import { dropDevices } from './push.tokens'

const MINUTE_MS = 60 * 1000
// Expo has a receipt about 15 minutes after the send, and keeps it a day.
export const RECEIPT_DELAY_MS = 15 * MINUTE_MS
const RECEIPT_TTL_MS = 24 * 60 * MINUTE_MS

// A sent push Expo will have a receipt for, by its ticket id, and the token
// it went to. Server-only, never published; kept in Mongo so a restart
// doesn't forget which devices to check (docs/spec.md §2.5).
export type PushTicketDoc = { _id: string; expoToken: string; sentAt: Date }

export const PushTickets = new Mongo.Collection<PushTicketDoc>('pushTickets')

export async function createPushTicketIndexes() {
  await PushTickets.createIndexAsync({ sentAt: 1 })
}

Meteor.startup(createPushTicketIndexes)

const isDeviceNotRegistered = (result: ExpoPushTicket | ExpoPushReceipt) =>
  result.status === 'error' && result.details?.error === 'DeviceNotRegistered'

const dropExpoTokens = async (expoTokens: string[]) => {
  if (!expoTokens.length) return
  await dropDevices(
    await PushTokens.find({ expoToken: { $in: expoTokens } }).fetchAsync(),
  )
}

/**
 * Keeps each accepted ticket for `checkPushReceipts`, and deletes each
 * device Expo refused outright as `DeviceNotRegistered`. `tickets[i]`
 * answers `messages[i]`.
 */
export async function trackPushTickets(
  messages: PushMessage[],
  tickets: ExpoPushTicket[],
) {
  const sentAt = new Date()
  const unregisteredTokens: string[] = []
  for (const [i, ticket] of tickets.entries()) {
    const expoToken = messages[i]!.to
    if (ticket.status === 'ok') {
      await PushTickets.insertAsync({ _id: ticket.id, expoToken, sentAt })
    } else if (isDeviceNotRegistered(ticket)) {
      unregisteredTokens.push(expoToken)
    } else {
      console.warn('push: Expo refused a push', ticket.message)
    }
  }
  await dropExpoTokens(unregisteredTokens)
}

/**
 * Fetches the receipts of the pushes sent at least `RECEIPT_DELAY_MS`
 * before `now`, and deletes each device Expo answered `DeviceNotRegistered`
 * for. A ticket whose receipt isn't ready yet stays to be asked about next
 * time, for as long as Expo keeps it.
 */
export async function checkPushReceipts(now = new Date()) {
  const client = pushClient()
  if (!client) return
  const due = await PushTickets.find({
    sentAt: { $lte: new Date(now.getTime() - RECEIPT_DELAY_MS) },
  }).fetchAsync()
  if (!due.length) return

  const receipts = await client.receipts(due.map(t => t._id))
  await dropExpoTokens(
    due
      .filter(t => receipts[t._id] && isDeviceNotRegistered(receipts[t._id]!))
      .map(t => t.expoToken),
  )
  const expiredBefore = now.getTime() - RECEIPT_TTL_MS
  const done = due.filter(
    t => receipts[t._id] || t.sentAt.getTime() < expiredBefore,
  )
  await PushTickets.removeAsync({ _id: { $in: done.map(t => t._id) } })
}

/** Checks push receipts every 5 minutes, so each is read about on time. */
export function schedulePushReceipts(): void {
  Meteor.setInterval(
    () =>
      void checkPushReceipts().catch(error =>
        console.error('push: checking receipts failed', error),
      ),
    5 * MINUTE_MS,
  )
}
