import type { ApnsEnvironment } from '@prezentowo/types'
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
