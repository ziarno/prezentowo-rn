import { Meteor } from 'meteor/meteor'

import { type PushProviderType, chatServer } from '../chat/chat.server'
import { type PushTokenDoc, PushTokens } from './push.collection'

/**
 * The Stream push provider that devices of `type` are registered with, as
 * settings.json names it: a dev build's APNs tokens are sandbox ones, so it
 * needs the sandbox provider (docs/spec.md §2.5). Throws when it isn't set.
 */
export function pushProviderName(type: PushProviderType): string {
  const name: unknown = Meteor.settings.stream?.pushProviders?.[type]
  if (typeof name !== 'string' || !name) {
    throw new Error(`Meteor.settings.stream.pushProviders.${type} is not set`)
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
