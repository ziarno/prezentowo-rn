import type { RegisterPushArgs, UnregisterPushArgs } from '@prezentowo/types'
import { Match, check } from 'meteor/check'
import { Meteor } from 'meteor/meteor'

import { type PushProviderType, chatServer } from '../chat/chat.server'
import { upsertStreamUsers } from '../chat/chat.users'
import { nonEmptyString } from '../patterns'
import { type PushTokenDoc, PushTokens } from './push.collection'
import { dropDevices, mayHavePush, pushProviderName } from './push.tokens'

const PROVIDER_TYPES: Record<PushTokenDoc['platform'], PushProviderType> = {
  ios: 'apn',
  android: 'firebase',
}

const register = async function (
  this: Meteor.MethodThisType,
  args: RegisterPushArgs,
) {
  check(args, {
    expoToken: nonEmptyString,
    deviceToken: nonEmptyString,
    platform: Match.OneOf('ios', 'android'),
    locale: Match.OneOf('en', 'pl'),
    apnsEnvironment: Match.Optional(Match.OneOf('development', 'production')),
  })
  if (!this.userId) {
    throw new Meteor.Error('notAuthorized', 'mustBeLoggedIn')
  }
  const userId = this.userId
  const { expoToken, deviceToken, platform, locale } = args
  // The app sends it from iOS; a device without one is taken for a store build.
  const apnsEnvironment = args.apnsEnvironment ?? 'production'
  // Either token may already be held: by another account on this device, or
  // by this one before a token rotated. Every such doc goes but this
  // device's own as it stands.
  const held = await PushTokens.find({
    $or: [{ expoToken }, { deviceToken }],
  }).fetchAsync()
  const mayPush = await mayHavePush(userId)
  const isThisDevicesOwn = (t: PushTokenDoc) =>
    t.userId === userId &&
    t.expoToken === expoToken &&
    t.deviceToken === deviceToken
  // Someone who may have no push keeps no doc here at all, this device's own
  // included.
  await dropDevices(mayPush ? held.filter(t => !isThisDevicesOwn(t)) : held)
  // Under 16, or not answered yet: the device goes to no one, with nothing
  // registered anywhere (docs/spec.md §10.5).
  if (!mayPush) return
  await PushTokens.upsertAsync(
    { expoToken },
    { $set: { userId, deviceToken, platform, locale, updatedAt: new Date() } },
  )

  const server = chatServer()
  if (!server) return
  const provider = PROVIDER_TYPES[platform]
  // Stream may never have seen this user; the upsert also carries `locale`
  // as their language, this device being the latest.
  await upsertStreamUsers(server, [userId])
  await server.addDevice(
    deviceToken,
    provider,
    userId,
    pushProviderName(provider, apnsEnvironment),
  )
}

// The token is the proof of the device, so there is no login check: a
// signed-out app unregisters on its next connection (docs/spec.md §10.5).
const unregister = async function (args: UnregisterPushArgs) {
  check(args, { expoToken: nonEmptyString })
  await dropDevices(
    await PushTokens.find({ expoToken: args.expoToken }).fetchAsync(),
  )
}

Meteor.methods({
  'push.register': register,
  'push.unregister': unregister,
})
