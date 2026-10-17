import type { RegisterPushArgs } from '@prezentowo/types'
import assert from 'assert'
import { Meteor } from 'meteor/meteor'

import {
  FAKE_PUSH_PROVIDERS,
  useFakeChatServer,
  useStreamPushProviders,
} from '../../../tests/chat'
import {
  bornAged,
  createEventWithMembers,
  createUser,
} from '../../../tests/fixtures'
import {
  callAsUser,
  rejectsWithReason,
  resetDatabase,
  subscribeAsUser,
  whileFailing,
} from '../../../tests/helpers'
import { setAge } from '../../../tests/push'
import { ownAccount } from '../accounts/accounts.publications'
import '../chat/chat.methods'
import { setChatServer } from '../chat/chat.server'
import { pinToday } from '../today'
import '../users/users.birthDate'
import '../users/users.pushPreference'
import { PushTokens, createPushTokenIndexes } from './push.collection'
import './push.methods'
import { removePushOfUnder16 } from './push.tokens'

const iosDevice = (
  extra: Partial<RegisterPushArgs> = {},
): RegisterPushArgs => ({
  expoToken: 'ExponentPushToken[ios-1]',
  deviceToken: 'a1b2c3',
  platform: 'ios',
  locale: 'pl',
  apnsEnvironment: 'development',
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

const preferencesOf = async (userId: string) =>
  (await Meteor.users.findOneAsync(userId))?.pushPreferences

const answerBirthDate = (userId: string, birthDate: string) =>
  callAsUser(userId, 'users.setBirthDate', { birthDate })

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
    await setAge(30, ola, bartek)
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
        providerName: FAKE_PUSH_PROVIDERS.apn.development,
      })
    })

    it('registers a production build’s iOS device with the production APNs provider', async function () {
      await register(ola, iosDevice({ apnsEnvironment: 'production' }))
      assert.deepStrictEqual(stream.devices.get('a1b2c3'), {
        userId: ola,
        provider: 'apn',
        providerName: FAKE_PUSH_PROVIDERS.apn.production,
      })
    })

    it('takes an iOS device without an environment for a production one', async function () {
      const { apnsEnvironment: _, ...older } = iosDevice()
      await register(ola, older)
      assert.strictEqual(
        stream.devices.get('a1b2c3')?.providerName,
        FAKE_PUSH_PROVIDERS.apn.production,
      )
    })

    it('moves a device to the other APNs provider when its environment changes', async function () {
      await register(ola, iosDevice({ apnsEnvironment: 'development' }))
      await register(ola, iosDevice({ apnsEnvironment: 'production' }))
      assert.strictEqual(
        stream.devices.get('a1b2c3')?.providerName,
        FAKE_PUSH_PROVIDERS.apn.production,
      )
    })

    it('rejects an APNs environment it doesn’t know', async function () {
      await assert.rejects(
        register(ola, iosDevice({ apnsEnvironment: 'staging' as never })),
      )
      assert.strictEqual(await PushTokens.find().countAsync(), 0)
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
          providerName: FAKE_PUSH_PROVIDERS.apn.development,
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

    for (const [name, age] of [
      ['under 16', 14],
      ['who has not given a date of birth', undefined],
    ] as const) {
      describe(`for a user ${name}`, function () {
        let kid: string

        beforeEach(async function () {
          kid = await createUser('Kasia')
          if (age) await setAge(age, kid)
        })

        it('stores no token and registers nothing with Stream', async function () {
          const before = stream.calls.length

          await register(kid, iosDevice())

          assert.strictEqual(await PushTokens.find().countAsync(), 0)
          assert.deepStrictEqual(stream.calls.slice(before), [])
          assert.deepStrictEqual(stream.devicesOf(kid), [])
        })

        it('still takes the device from the account that held it', async function () {
          await register(ola, iosDevice())

          await register(kid, iosDevice())

          assert.deepStrictEqual(await tokensOf(ola), [])
          assert.deepStrictEqual(stream.devicesOf(ola), [])
          assert.strictEqual(await PushTokens.find().countAsync(), 0)
        })

        it('drops a token it already holds, even while chat is off', async function () {
          await PushTokens.insertAsync({
            _id: 'old',
            userId: kid,
            expoToken: 'ExponentPushToken[ios-1]',
            deviceToken: 'a1b2c3',
            platform: 'ios',
            locale: 'pl',
            updatedAt: new Date(),
          })
          setChatServer(null)

          await register(kid, iosDevice())

          assert.deepStrictEqual(await tokensOf(kid), [])
        })
      })
    }

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

    it('writes nothing for a user under 16, chat included, and never turns Stream’s chat push on', async function () {
      const kid = await createUser('Kasia')
      await setAge(14, kid)
      const before = stream.calls.length

      await setPreference(kid, 'chat', true)
      await setPreference(kid, 'invited', true)

      assert.deepStrictEqual(stream.calls.slice(before), [])
      assert.strictEqual(stream.chatLevels.has(kid), false)
      assert.strictEqual(await preferencesOf(kid), undefined)
    })

    it('writes nothing for a user who has not given a date of birth', async function () {
      const kid = await createUser('Kasia')
      await setPreference(kid, 'chat', true)
      assert.strictEqual(stream.chatLevels.has(kid), false)
      assert.strictEqual(await preferencesOf(kid), undefined)
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

  // 15 years and 364 days old on Oct 17, 16 on Oct 18: no migration or job
  // runs between the two checks.
  describe('a user who turns 16 between two checks', function () {
    let teen: string

    beforeEach(async function () {
      teen = await createUser('Kasia', '2010-10-18')
    })
    afterEach(() => pinToday(null))

    it('registers a device from the day they turn 16, not before', async function () {
      pinToday('2026-10-17')
      await register(teen, iosDevice())
      assert.deepStrictEqual(await tokensOf(teen), [])
      assert.deepStrictEqual(stream.devicesOf(teen), [])

      pinToday('2026-10-18')
      await register(teen, iosDevice())
      assert.strictEqual((await tokensOf(teen)).length, 1)
      assert.deepStrictEqual(stream.devicesOf(teen), ['a1b2c3'])
    })

    it('can switch a preference, with Stream written through, from the day they turn 16', async function () {
      pinToday('2026-10-17')
      await setPreference(teen, 'chat', true)
      assert.strictEqual(stream.chatLevels.has(teen), false)
      assert.strictEqual(await preferencesOf(teen), undefined)

      pinToday('2026-10-18')
      await setPreference(teen, 'chat', true)
      assert.strictEqual(stream.chatLevels.get(teen), 'all')
      assert.deepStrictEqual(await preferencesOf(teen), { chat: true })
    })

    it('has the device the sweep took away only until they register again', async function () {
      pinToday('2026-10-18')
      await register(teen, iosDevice())

      // The sweep runs on a day before the birthday: the device goes.
      await removePushOfUnder16('2026-10-17')
      assert.deepStrictEqual(await tokensOf(teen), [])

      await register(teen, iosDevice())
      await removePushOfUnder16()
      assert.strictEqual((await tokensOf(teen)).length, 1)
    })
  })

  describe('the startup sweep of devices held by accounts under 16', function () {
    let kid: string
    let unanswered: string

    beforeEach(async function () {
      kid = await createUser('Kasia')
      unanswered = await createUser('Wiktor')
      await setAge(30, kid, unanswered)
      await register(ola, iosDevice())
      await register(kid, androidDevice())
      await register(
        unanswered,
        iosDevice({
          expoToken: 'ExponentPushToken[ios-2]',
          deviceToken: 'd4e5f6',
        }),
      )
      // Accounts from before the age question, or under 16 since.
      await Meteor.users.updateAsync(kid, {
        $set: { birthDate: bornAged(14) },
      })
      await Meteor.users.updateAsync(unanswered, { $unset: { birthDate: 1 } })
    })

    it('removes the devices of everyone under 16 today, from the table and from Stream', async function () {
      await removePushOfUnder16()

      assert.deepStrictEqual(await tokensOf(kid), [])
      assert.deepStrictEqual(await tokensOf(unanswered), [])
      assert.deepStrictEqual(stream.devicesOf(kid), [])
      assert.deepStrictEqual(stream.devicesOf(unanswered), [])
    })

    it('keeps the devices of a 16+ account', async function () {
      await removePushOfUnder16()

      assert.strictEqual((await tokensOf(ola)).length, 1)
      assert.deepStrictEqual(stream.devicesOf(ola), ['a1b2c3'])
    })

    it('can be run again', async function () {
      await removePushOfUnder16()
      await removePushOfUnder16()

      assert.strictEqual(await PushTokens.find().countAsync(), 1)
    })
  })

  describe('when the date of birth is set on an account that has devices', function () {
    let kid: string

    beforeEach(async function () {
      // An account from before the age question, with a device registered.
      kid = await createUser('Kasia')
      await setAge(30, kid)
      await register(kid, iosDevice())
      await register(kid, androidDevice())
      await Meteor.users.updateAsync(kid, { $unset: { birthDate: 1 } })
    })

    it('removes the devices of an under-16 date from the table and from Stream', async function () {
      assert.strictEqual((await tokensOf(kid)).length, 2)

      await answerBirthDate(kid, bornAged(14))

      assert.deepStrictEqual(await tokensOf(kid), [])
      assert.deepStrictEqual(stream.devicesOf(kid), [])
    })

    it('keeps the devices of a 16+ date', async function () {
      await answerBirthDate(kid, bornAged(30))
      assert.strictEqual((await tokensOf(kid)).length, 2)
      assert.deepStrictEqual(stream.devicesOf(kid), ['a1b2c3', 'fcm-token-1'])
    })

    it('keeps the question open while Stream can’t remove a device', async function () {
      await whileFailing(stream, 'removeDevice', () =>
        assert.rejects(answerBirthDate(kid, bornAged(14))),
      )
      assert.strictEqual(
        (await Meteor.users.findOneAsync(kid))?.birthDate,
        undefined,
      )

      await answerBirthDate(kid, bornAged(14))
      assert.deepStrictEqual(await tokensOf(kid), [])
    })
  })
})
