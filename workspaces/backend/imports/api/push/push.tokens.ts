import { type ApnsEnvironment, isSixteenPlus } from '@prezentowo/types'
import { Meteor } from 'meteor/meteor'

import { type PushProviderType, chatServer } from '../chat/chat.server'
import { type PushTokenDoc, PushTokens } from './push.collection'

/**
 * The Stream push provider that a device registers with, as settings.json
 * names it: `stream.pushProviders.firebase` for Android, and for iOS the
 * `stream.pushProviders.apn` entry for the build's APNs environment, since a
 * dev build's tokens are sandbox ones (docs/spec.md §2.5). Throws when it
 * isn't set.
 */
export function pushProviderName(
  type: PushProviderType,
  apnsEnvironment: ApnsEnvironment,
): string {
  const providers = Meteor.settings.stream?.pushProviders
  const name: unknown =
    type === 'apn' ? providers?.apn?.[apnsEnvironment] : providers?.firebase
  if (typeof name !== 'string' || !name) {
    const key = type === 'apn' ? `apn.${apnsEnvironment}` : type
    throw new Error(`Meteor.settings.stream.pushProviders.${key} is not set`)
  }
  return name
}

// Each device leaves Stream before its doc goes, one at a time, so a Stream
// failure leaves the doc to try again with.
export async function dropDevices(tokens: PushTokenDoc[]) {
  const server = chatServer()
  for (const token of tokens) {
    if (server) await server.removeDevice(token.deviceToken, token.userId)
    await PushTokens.removeAsync(token._id)
  }
}

/**
 * Deletes every push token of `userId`, removing each device from Stream
 * first (docs/spec.md §10.4 step 8).
 */
export const removePushTokensOf = async (userId: string) =>
  dropDevices(await PushTokens.find({ userId }).fetchAsync())

/**
 * Whether `userId` may have push at all: only the 16+ band, since push is the
 * one processing that rests on consent, which under 16 would need a parent
 * (docs/spec.md §1.15, §10.5). The 13-15 band and "not answered yet" are both
 * no. Every path that registers a device or sends a push asks this.
 */
export async function mayHavePush(userId: string) {
  return isSixteenPlus(
    await Meteor.users.findOneAsync(userId, { fields: { ageBand: 1 } }),
  )
}

/**
 * Removes the devices of every account that may not have push, from the
 * table and from Stream: the accounts from before the age question, which
 * kept theirs until they answered (docs/spec.md §10.5). Idempotent. Mobile
 * registers again once the person answers 16+.
 */
export async function removePushOfUnder16() {
  const held = await PushTokens.find({}, { fields: { userId: 1 } }).fetchAsync()
  for (const userId of new Set(held.map(token => token.userId))) {
    if (!(await mayHavePush(userId))) await removePushTokensOf(userId)
  }
}
