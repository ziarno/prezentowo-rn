import type { RegisterPushArgs } from '@prezentowo/types'
import assert from 'assert'
import { Meteor } from 'meteor/meteor'

import {
  FAKE_PUSH_PROVIDERS,
  useFakeChatServer,
  useStreamPushProviders,
} from '../../../tests/chat'
import { createEventWithMembers, createUser } from '../../../tests/fixtures'
import {
  callAsUser,
  rejectsWithReason,
  resetDatabase,
  subscribeAsUser,
  whileFailing,
} from '../../../tests/helpers'
import { ownAccount } from '../accounts/accounts.publications'
import '../chat/chat.methods'
import { setChatServer } from '../chat/chat.server'
import '../users/users.pushPreference'
import { PushTokens, createPushTokenIndexes } from './push.collection'
import './push.methods'

const iosDevice = (
  extra: Partial<RegisterPushArgs> = {},
): RegisterPushArgs => ({
  expoToken: 'ExponentPushToken[ios-1]',
  deviceToken: 'a1b2c3',
  platform: 'ios',
  locale: 'pl',
  ...extra,
})

const androidDevice = (
  extra: Partial<RegisterPushArgs> = {},
): RegisterPushArgs => ({
  expoToken: 'ExponentPushToken[android-1]',
  deviceToken: 'fcm-token-1',
  platform: 'android',
  locale: 'en',
  ...extra,
})

const register = (userId: string | null, args: RegisterPushArgs) =>
  callAsUser(userId, 'push.register', args)

const unregister = (userId: string | null, expoToken: string) =>
  callAsUser(userId, 'push.unregister', { expoToken })

const setPreference = (userId: string | null, kind: string, enabled: boolean) =>
  callAsUser(userId, 'users.setPushPreference', { kind, enabled })

const tokensOf = (userId: string) => PushTokens.find({ userId }).fetchAsync()

describe('push', function () {
  const stream = useFakeChatServer()
  useStreamPushProviders()

  let ola: string
  let bartek: string

  before(async function () {
    await createPushTokenIndexes()
  })

  beforeEach(async function () {
    await resetDatabase()
    ola = await createUser('Ola')
    bartek = await createUser('Bartek')
  })

  describe('push.register', function () {
    it('is for signed-in users only', async function () {
      await rejectsWithReason(register(null, iosDevice()), 'mustBeLoggedIn')
      assert.strictEqual(await PushTokens.find().countAsync(), 0)
    })

    it('rejects a platform or locale it doesn’t know', async function () {
      await assert.rejects(
        register(ola, iosDevice({ platform: 'web' as never })),
      )
      await assert.rejects(register(ola, iosDevice({ locale: 'de' as never })))
      assert.strictEqual(await PushTokens.find().countAsync(), 0)
    })

    it('stores the device for the caller', async function () {
      const before = Date.now()
      await register(ola, iosDevice())

      const [token, ...rest] = await tokensOf(ola)
      assert.deepStrictEqual(rest, [])
      assert.strictEqual(token!.expoToken, 'ExponentPushToken[ios-1]')
      assert.strictEqual(token!.deviceToken, 'a1b2c3')
      assert.strictEqual(token!.platform, 'ios')
      assert.strictEqual(token!.locale, 'pl')
      assert.ok(token!.updatedAt.getTime() >= before)
    })

    it('registers an iOS device with Stream’s APNs provider', async function () {
      await register(ola, iosDevice())
      assert.deepStrictEqual(stream.devices.get('a1b2c3'), {
        userId: ola,
        provider: 'apn',
        providerName: FAKE_PUSH_PROVIDERS.apn,
      })
    })

    it('registers an Android device with Stream’s Firebase provider', async function () {
      await register(ola, androidDevice())
      assert.deepStrictEqual(stream.devices.get('fcm-token-1'), {
        userId: ola,
        provider: 'firebase',
        providerName: FAKE_PUSH_PROVIDERS.firebase,
      })
    })

    it('sets the Stream user’s language, even for a user Stream never saw', async function () {
      assert.strictEqual(stream.users.has(ola), false)
      await register(ola, iosDevice({ locale: 'pl' }))
      assert.deepStrictEqual(stream.users.get(ola), {
        name: 'Ola',
        language: 'pl',
      })
    })

    it('keeps the language when chat upserts the user later', async function () {
      await register(ola, iosDevice({ locale: 'pl' }))
      await createEventWithMembers(ola, [bartek])
      await callAsUser(ola, 'stream.token')
      assert.strictEqual(stream.users.get(ola)?.language, 'pl')
    })

    it('is idempotent, and follows a language change', async function () {
      await register(ola, iosDevice({ locale: 'pl' }))
      await register(ola, iosDevice({ locale: 'pl' }))
      await register(ola, iosDevice({ locale: 'en' }))

      const tokens = await tokensOf(ola)
      assert.strictEqual(tokens.length, 1)
      assert.strictEqual(tokens[0]!.locale, 'en')
      assert.deepStrictEqual(stream.devicesOf(ola), ['a1b2c3'])
      assert.strictEqual(stream.users.get(ola)?.language, 'en')
    })

    it('keeps one doc per device of the same user', async function () {
      await register(ola, iosDevice())
      await register(ola, androidDevice())
      assert.strictEqual((await tokensOf(ola)).length, 2)
      assert.deepStrictEqual(stream.devicesOf(ola), ['a1b2c3', 'fcm-token-1'])
    })

    it('takes the tokens from another account first', async function () {
      await register(ola, iosDevice())
      const before = stream.calls.length

      await register(bartek, iosDevice({ locale: 'en' }))

      assert.deepStrictEqual(await tokensOf(ola), [])
      assert.strictEqual((await tokensOf(bartek)).length, 1)
      assert.deepStrictEqual(stream.devicesOf(ola), [])
      assert.deepStrictEqual(stream.devicesOf(bartek), ['a1b2c3'])
      const ops = stream.calls
        .slice(before)
        .filter(c => c.op === 'removeDevice' || c.op === 'addDevice')
      assert.deepStrictEqual(ops, [
        { op: 'removeDevice', deviceToken: 'a1b2c3', userId: ola },
        {
          op: 'addDevice',
          deviceToken: 'a1b2c3',
          provider: 'apn',
          userId: bartek,
          providerName: FAKE_PUSH_PROVIDERS.apn,
        },
      ])
    })

    it('takes a device that matches on either token', async function () {
      await register(ola, iosDevice())
      await register(ola, androidDevice())

      // Bartek's device carries Ola's iOS Expo token and her Android native
      // token: both of her docs go.
      await register(
        bartek,
        iosDevice({ deviceToken: 'fcm-token-1', platform: 'android' }),
      )

      assert.deepStrictEqual(await tokensOf(ola), [])
      assert.deepStrictEqual(stream.devicesOf(ola), [])
      assert.deepStrictEqual(stream.devicesOf(bartek), ['fcm-token-1'])
    })

    it('replaces a rotated native token, removing the old one from Stream', async function () {
      await register(ola, iosDevice({ deviceToken: 'old' }))
      await register(ola, iosDevice({ deviceToken: 'new' }))

      const tokens = await tokensOf(ola)
      assert.deepStrictEqual(
        tokens.map(t => t.deviceToken),
        ['new'],
      )
      assert.deepStrictEqual(stream.devicesOf(ola), ['new'])
    })

    it('replaces a rotated Expo token', async function () {
      await register(ola, iosDevice({ expoToken: 'ExponentPushToken[old]' }))
      await register(ola, iosDevice({ expoToken: 'ExponentPushToken[new]' }))

      const tokens = await tokensOf(ola)
      assert.deepStrictEqual(
        tokens.map(t => t.expoToken),
        ['ExponentPushToken[new]'],
      )
      assert.deepStrictEqual(stream.devicesOf(ola), ['a1b2c3'])
    })

    it('leaves the other account’s token in place while Stream fails', async function () {
      await register(ola, iosDevice())
      await whileFailing(stream, 'removeDevice', () =>
        assert.rejects(register(bartek, iosDevice())),
      )
      assert.strictEqual((await tokensOf(ola)).length, 1)
      assert.deepStrictEqual(await tokensOf(bartek), [])

      await register(bartek, iosDevice())
      assert.deepStrictEqual(await tokensOf(ola), [])
      assert.deepStrictEqual(stream.devicesOf(bartek), ['a1b2c3'])
    })

    it('stores the device while chat is off', async function () {
      setChatServer(null)
      await register(ola, iosDevice())
      assert.strictEqual((await tokensOf(ola)).length, 1)
    })
  })

  describe('push.unregister', function () {
    it('needs no login: deletes the device and removes it from Stream', async function () {
      await register(ola, iosDevice())

      await unregister(null, 'ExponentPushToken[ios-1]')

      assert.deepStrictEqual(await tokensOf(ola), [])
      assert.deepStrictEqual(stream.devicesOf(ola), [])
    })

    it('is a no-op for an unknown token', async function () {
      await register(ola, iosDevice())
      const before = stream.calls.length

      await unregister(null, 'ExponentPushToken[unknown]')

      assert.strictEqual((await tokensOf(ola)).length, 1)
      assert.deepStrictEqual(stream.calls.slice(before), [])
    })

    it('keeps the device while Stream fails, so it can be sent again', async function () {
      await register(ola, iosDevice())
      await whileFailing(stream, 'removeDevice', () =>
        assert.rejects(unregister(null, 'ExponentPushToken[ios-1]')),
      )
      assert.strictEqual((await tokensOf(ola)).length, 1)
    })

    it('deletes the device while chat is off', async function () {
      await register(ola, iosDevice())
      setChatServer(null)
      await unregister(null, 'ExponentPushToken[ios-1]')
      assert.deepStrictEqual(await tokensOf(ola), [])
    })
  })

  describe('users.setPushPreference', function () {
    const preferencesOf = async (userId: string) =>
      (await Meteor.users.findOneAsync(userId))?.pushPreferences

    it('is for signed-in users only', async function () {
      await rejectsWithReason(
        setPreference(null, 'invited', false),
        'mustBeLoggedIn',
      )
    })

    it('rejects a kind that doesn’t push', async function () {
      await assert.rejects(setPreference(ola, 'invite-deferred', false))
      assert.strictEqual(await preferencesOf(ola), undefined)
    })

    it('sets one kind, leaving the others, without a Stream call', async function () {
      const before = stream.calls.length
      await setPreference(ola, 'invited', false)
      await setPreference(ola, 'suggestion-claimed', true)

      assert.deepStrictEqual(await preferencesOf(ola), {
        invited: false,
        'suggestion-claimed': true,
      })
      assert.deepStrictEqual(stream.calls.slice(before), [])
    })

    it('writes chat through to Stream’s chat level', async function () {
      await setPreference(ola, 'chat', false)
      assert.strictEqual(stream.chatLevels.get(ola), 'none')
      assert.deepStrictEqual(await preferencesOf(ola), { chat: false })

      await setPreference(ola, 'chat', true)
      assert.strictEqual(stream.chatLevels.get(ola), 'all')
      assert.deepStrictEqual(await preferencesOf(ola), { chat: true })
    })

    it('changes nothing for chat while Stream fails', async function () {
      await whileFailing(stream, 'setPushPreferences', () =>
        assert.rejects(setPreference(ola, 'chat', false)),
      )
      assert.strictEqual(await preferencesOf(ola), undefined)
    })

    it('is published to the user alone', async function () {
      await setPreference(ola, 'chat', false)

      const own = await subscribeAsUser(ola, ownAccount)
      assert.deepStrictEqual(own.docs('users').get(ola)?.pushPreferences, {
        chat: false,
      })
      own.stop()

      const other = await subscribeAsUser(bartek, ownAccount)
      assert.strictEqual(other.docs('users').has(ola), false)
      other.stop()
    })
  })
})
