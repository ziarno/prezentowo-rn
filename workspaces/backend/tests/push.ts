import type { AgeBand } from '@prezentowo/types'
import type { ExpoPushReceipt, ExpoPushTicket } from 'expo-server-sdk'
import { Meteor } from 'meteor/meteor'

import {
  type PushClient,
  type PushMessage,
  setPushClient,
} from '../imports/api/push/push.client'
import { inboxPushesSettled } from '../imports/api/push/push.inbox'

/**
 * An in-memory Expo Push Service: records every message it's sent and
 * answers each with a ticket. Tokens in `unregistered` get a
 * `DeviceNotRegistered` receipt; `failing` makes every call reject.
 */
export class FakePushClient implements PushClient {
  sent: PushMessage[] = []
  // Ticket id → the token it went to.
  tickets = new Map<string, string>()
  receiptRequests: string[][] = []
  unregistered = new Set<string>()
  // Tokens Expo refuses at the send itself, without a receipt.
  refusedAtSend = new Set<string>()
  // Ticket ids whose receipt isn't ready yet.
  notReady = new Set<string>()
  failing = false

  reset() {
    this.sent = []
    this.tickets.clear()
    this.receiptRequests = []
    this.unregistered.clear()
    this.refusedAtSend.clear()
    this.notReady.clear()
    this.failing = false
  }

  /** The messages sent to `expoToken`. */
  sentTo(expoToken: string) {
    return this.sent.filter(m => m.to === expoToken)
  }

  async send(messages: PushMessage[]): Promise<ExpoPushTicket[]> {
    if (this.failing) throw new Error('Expo is unreachable')
    return messages.map(message => {
      this.sent.push(message)
      if (this.refusedAtSend.has(message.to)) {
        return {
          status: 'error',
          message: 'not a registered push notification recipient',
          details: { error: 'DeviceNotRegistered', expoPushToken: message.to },
        }
      }
      const id = `ticket-${this.tickets.size + 1}`
      this.tickets.set(id, message.to)
      return { status: 'ok', id }
    })
  }

  async receipts(ticketIds: string[]) {
    if (this.failing) throw new Error('Expo is unreachable')
    this.receiptRequests.push([...ticketIds])
    const receipts: Record<string, ExpoPushReceipt> = {}
    for (const id of ticketIds) {
      const token = this.tickets.get(id)
      if (!token || this.notReady.has(id)) continue
      receipts[id] = this.unregistered.has(token)
        ? {
            status: 'error',
            message: 'not a registered push notification recipient',
            details: { error: 'DeviceNotRegistered', expoPushToken: token },
          }
        : { status: 'ok' }
    }
    return receipts
  }
}

/**
 * Installs a fresh `FakePushClient` as the Expo client for each test in the
 * enclosing `describe`, and turns push back off afterwards, once every
 * queued push has settled.
 */
export function useFakePushClient() {
  const fake = new FakePushClient()
  beforeEach(function () {
    fake.reset()
    setPushClient(fake)
  })
  afterEach(async function () {
    await inboxPushesSettled()
    setPushClient(null)
  })
  return fake
}

/**
 * Stores `ageBand` on each of `userIds`, as the first-login question does
 * (docs/spec.md §1.15). Push is 16+ only, so a test of push seats its users
 * in that band first.
 */
export async function setAgeBand(ageBand: AgeBand, ...userIds: string[]) {
  await Meteor.users.updateAsync(
    { _id: { $in: userIds } },
    { $set: { ageBand } },
    { multi: true },
  )
}
