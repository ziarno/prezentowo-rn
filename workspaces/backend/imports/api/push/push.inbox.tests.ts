import type { AppLanguage, NotificationDoc } from '@prezentowo/types'
import assert from 'assert'
import { Meteor } from 'meteor/meteor'
import { Random } from 'meteor/random'

import { addGiftAs, createFamilyEvent } from '../../../tests/fixtures'
import { callAsUser, resetDatabase } from '../../../tests/helpers'
import { setAge, useFakePushClient } from '../../../tests/push'
import { Invites, createInviteIndexes } from '../invites/invites.collection'
import '../invites/invites.methods'
import {
  Notifications,
  createNotificationIndexes,
} from '../notifications/notifications.collection'
import { pinToday } from '../today'
import '../users/users.pushPreference'
import { PushTokens, createPushTokenIndexes } from './push.collection'
import { inboxPushesSettled, sendInboxPush } from './push.inbox'
import {
  RECEIPT_DELAY_MS,
  checkPushReceipts,
  createPushTicketIndexes,
} from './push.receipts'

// A device of `userId`'s, stored as `push.register` would.
const addDevice = async (
  userId: string,
  expoToken: string,
  locale: AppLanguage = 'en',
) => {
  await PushTokens.insertAsync({
    _id: Random.id(),
    userId,
    expoToken,
    deviceToken: `native-${expoToken}`,
    platform: 'ios',
    locale,
    updatedAt: new Date(),
  })
}

const expoTokensOf = async (userId: string) =>
  (await PushTokens.find({ userId }).fetchAsync()).map(t => t.expoToken).sort()

describe('inbox push', function () {
  const expo = useFakePushClient()

  let family: Awaited<ReturnType<typeof createFamilyEvent>>
  let users: typeof family.users

  before(async function () {
    await createInviteIndexes()
    await createNotificationIndexes()
    await createPushTokenIndexes()
    await createPushTicketIndexes()
  })

  beforeEach(async function () {
    await resetDatabase()
    family = await createFamilyEvent()
    users = family.users
    await setAge(30, ...Object.values(users))
    await inboxPushesSettled()
  })

  // Bartek suggests a present for Celina, which Ola claims: Bartek hears
  // `suggestion-claimed`.
  const claimSuggestion = async (title = 'Lego') => {
    const giftId = await addGiftAs(
      users.bartek,
      family.eventId,
      family.participants.celina,
      title,
    )
    await callAsUser(users.ola, 'gifts.claim', { giftId })
    await inboxPushesSettled()
    return giftId
  }

  const codeOf = async () =>
    (await Invites.findOneAsync({ eventId: family.eventId }))!.code

  describe('who gets it', function () {
    it('goes once to each of the recipient’s devices, and nobody else’s', async function () {
      await addDevice(users.bartek, 'bartek-phone')
      await addDevice(users.bartek, 'bartek-tablet')
      await addDevice(users.ola, 'ola-phone')

      await claimSuggestion()

      assert.deepStrictEqual(expo.sent.map(m => m.to).sort(), [
        'bartek-phone',
        'bartek-tablet',
      ])
    })

    it('sends nothing to a recipient with no devices', async function () {
      await claimSuggestion()
      assert.deepStrictEqual(expo.sent, [])
    })

    it('skips a kind the recipient turned off, still landing in the inbox', async function () {
      await addDevice(users.bartek, 'bartek-phone')
      await callAsUser(users.bartek, 'users.setPushPreference', {
        kind: 'suggestion-claimed',
        enabled: false,
      })

      await claimSuggestion()

      assert.deepStrictEqual(expo.sent, [])
      assert.strictEqual(
        await Notifications.find({
          userId: users.bartek,
          kind: 'suggestion-claimed',
        }).countAsync(),
        1,
      )
    })

    for (const [name, age] of [
      ['under 16', 14],
      ['who has not given a date of birth', undefined],
    ] as const) {
      it(`sends nothing to a user ${name}, even with a device stored, still landing in the inbox`, async function () {
        await addDevice(users.bartek, 'bartek-phone')
        if (age) await setAge(age, users.bartek)
        else
          await Meteor.users.updateAsync(users.bartek, {
            $unset: { birthDate: 1 },
          })

        await claimSuggestion()

        assert.deepStrictEqual(expo.sent, [])
        assert.strictEqual(
          await Notifications.find({
            userId: users.bartek,
            kind: 'suggestion-claimed',
          }).countAsync(),
          1,
        )
      })
    }

    // 15 years and 364 days old on Oct 17, 16 on Oct 18: nothing runs between.
    it('starts sending to a user the day they turn 16', async function () {
      await addDevice(users.bartek, 'bartek-phone')
      await Meteor.users.updateAsync(users.bartek, {
        $set: { birthDate: '2010-10-18' },
      })
      try {
        pinToday('2026-10-17')
        await claimSuggestion('Lego')
        assert.deepStrictEqual(expo.sent, [])

        pinToday('2026-10-18')
        await claimSuggestion('Duplo')
        assert.deepStrictEqual(expo.sentTo('bartek-phone').length, 1)
        assert.strictEqual(expo.sent.length, 1)
      } finally {
        pinToday(null)
      }
    })

    it('still pushes a kind left on when another is off', async function () {
      await addDevice(users.bartek, 'bartek-phone')
      await callAsUser(users.bartek, 'users.setPushPreference', {
        kind: 'invited',
        enabled: false,
      })
      await claimSuggestion()
      assert.strictEqual(expo.sent.length, 1)
    })

    it('never pushes invite-deferred', async function () {
      await addDevice(users.outsider, 'outsider-phone')
      await callAsUser(users.outsider, 'invites.ignore', {
        code: await codeOf(),
      })
      const deferred = await Notifications.findOneAsync({
        userId: users.outsider,
      })
      assert.strictEqual(deferred?.kind, 'invite-deferred')

      await sendInboxPush(deferred)
      assert.deepStrictEqual(expo.sent, [])
    })

    it('never pushes event-handed-over', async function () {
      await addDevice(users.bartek, 'bartek-phone')
      await sendInboxPush({
        _id: Random.id(),
        userId: users.bartek,
        kind: 'event-handed-over',
        eventId: family.eventId,
        createdAt: new Date(),
        read: false,
      })
      assert.deepStrictEqual(expo.sent, [])
    })
  })

  describe('what it says', function () {
    it('suggestion-claimed, in each device’s language', async function () {
      await addDevice(users.bartek, 'bartek-en', 'en')
      await addDevice(users.bartek, 'bartek-pl', 'pl')

      await claimSuggestion()

      const [en] = expo.sentTo('bartek-en')
      const [pl] = expo.sentTo('bartek-pl')
      assert.strictEqual(en?.title, 'Wigilia')
      assert.strictEqual(en?.body, 'Ola is buying “Lego”')
      assert.strictEqual(pl?.title, 'Wigilia')
      assert.strictEqual(pl?.body, 'Ola kupuje „Lego”')
    })

    it('claimed-gift-removed, never naming the deleter', async function () {
      const giftId = await claimSuggestion()
      await addDevice(users.ola, 'ola-en', 'en')
      await addDevice(users.ola, 'ola-pl', 'pl')

      await callAsUser(users.bartek, 'gifts.remove', { giftId })
      await inboxPushesSettled()

      assert.strictEqual(expo.sentTo('ola-en')[0]?.body, '“Lego” was removed')
      assert.strictEqual(expo.sentTo('ola-pl')[0]?.body, 'Usunięto „Lego”')
      assert.strictEqual(expo.sentTo('ola-pl')[0]?.title, 'Wigilia')
    })

    it('participant-joined, to the creator', async function () {
      await addDevice(users.ola, 'ola-en', 'en')
      await addDevice(users.ola, 'ola-pl', 'pl')

      await callAsUser(users.outsider, 'events.join', { code: await codeOf() })
      await inboxPushesSettled()

      assert.strictEqual(expo.sentTo('ola-en')[0]?.body, 'Outsider joined')
      assert.strictEqual(expo.sentTo('ola-pl')[0]?.body, 'Outsider dołącza')
    })

    it('invited, naming the event’s creator', async function () {
      await addDevice(users.outsider, 'outsider-en', 'en')
      await addDevice(users.outsider, 'outsider-pl', 'pl')

      await callAsUser(users.ola, 'events.create', {
        title: 'Imieniny',
        date: '2026-07-26',
        type: 'many-to-many',
        participants: [
          { kind: 'invited', userId: users.outsider, color: '#3c3' },
        ],
      })
      await inboxPushesSettled()

      const [en] = expo.sentTo('outsider-en')
      assert.strictEqual(en?.title, 'Imieniny')
      assert.strictEqual(en?.body, 'Ola invited you')
      assert.strictEqual(
        expo.sentTo('outsider-pl')[0]?.body,
        'Ola zaprasza Cię',
      )
    })

    it('says "Someone" for a person who no longer resolves', async function () {
      await addDevice(users.bartek, 'bartek-en', 'en')
      await addDevice(users.bartek, 'bartek-pl', 'pl')
      const notification: NotificationDoc = {
        _id: Random.id(),
        userId: users.bartek,
        kind: 'suggestion-claimed',
        eventId: family.eventId,
        giftTitle: 'Lego',
        claimedByParticipantId: 'gone',
        createdAt: new Date(),
        read: false,
      }

      await sendInboxPush(notification)

      assert.strictEqual(
        expo.sentTo('bartek-en')[0]?.body,
        'Someone is buying “Lego”',
      )
      assert.strictEqual(
        expo.sentTo('bartek-pl')[0]?.body,
        'Ktoś kupuje „Lego”',
      )
    })

    it('carries the notification as InboxPushData', async function () {
      await addDevice(users.bartek, 'bartek-phone')
      const giftId = await claimSuggestion()
      const notification = await Notifications.findOneAsync({
        userId: users.bartek,
        kind: 'suggestion-claimed',
      })

      assert.deepStrictEqual(expo.sent[0]?.data, {
        notificationId: notification!._id,
        kind: 'suggestion-claimed',
        eventId: family.eventId,
        giftId,
        recipientParticipantId: family.participants.celina,
      })
    })

    it('leaves out what the notification doesn’t have', async function () {
      await addDevice(users.ola, 'ola-phone')
      await callAsUser(users.outsider, 'events.join', { code: await codeOf() })
      await inboxPushesSettled()
      const notification = await Notifications.findOneAsync({
        userId: users.ola,
        kind: 'participant-joined',
      })

      assert.deepStrictEqual(expo.sent[0]?.data, {
        notificationId: notification!._id,
        kind: 'participant-joined',
        eventId: family.eventId,
      })
    })

    it('badges the unread count after the insert', async function () {
      await addDevice(users.bartek, 'bartek-phone')
      const base = {
        userId: users.bartek,
        kind: 'participant-joined' as const,
        eventId: family.eventId,
        createdAt: new Date(),
      }
      await Notifications.insertAsync({ ...base, read: true } as never)
      await Notifications.insertAsync({ ...base, read: false } as never)

      await claimSuggestion()

      assert.strictEqual(expo.sent[0]?.badge, 2)
    })
  })

  describe('failures', function () {
    it('never fail the method, and the notification still lands', async function () {
      await addDevice(users.bartek, 'bartek-phone')
      expo.failing = true

      await claimSuggestion()

      assert.strictEqual(
        await Notifications.find({
          userId: users.bartek,
          kind: 'suggestion-claimed',
        }).countAsync(),
        1,
      )
    })
  })

  describe('receipts', function () {
    const later = (ms: number) => new Date(Date.now() + ms)

    it('delete a device Expo no longer has, about 15 minutes on', async function () {
      await addDevice(users.bartek, 'bartek-old')
      await addDevice(users.bartek, 'bartek-new')
      expo.unregistered.add('bartek-old')
      await claimSuggestion()

      await checkPushReceipts(later(RECEIPT_DELAY_MS - 60_000))
      assert.deepStrictEqual(expo.receiptRequests, [])
      assert.deepStrictEqual(await expoTokensOf(users.bartek), [
        'bartek-new',
        'bartek-old',
      ])

      await checkPushReceipts(later(RECEIPT_DELAY_MS))
      assert.deepStrictEqual(await expoTokensOf(users.bartek), ['bartek-new'])
    })

    it('are asked for once each', async function () {
      await addDevice(users.bartek, 'bartek-phone')
      await claimSuggestion()

      await checkPushReceipts(later(RECEIPT_DELAY_MS))
      await checkPushReceipts(later(2 * RECEIPT_DELAY_MS))

      assert.deepStrictEqual(expo.receiptRequests, [['ticket-1']])
    })

    it('are asked for again while Expo hasn’t got one yet', async function () {
      await addDevice(users.bartek, 'bartek-phone')
      expo.unregistered.add('bartek-phone')
      await claimSuggestion()
      expo.notReady.add('ticket-1')

      await checkPushReceipts(later(RECEIPT_DELAY_MS))
      assert.deepStrictEqual(await expoTokensOf(users.bartek), ['bartek-phone'])

      expo.notReady.clear()
      await checkPushReceipts(later(RECEIPT_DELAY_MS))
      assert.deepStrictEqual(await expoTokensOf(users.bartek), [])
    })

    it('are asked for again after a failed fetch', async function () {
      await addDevice(users.bartek, 'bartek-phone')
      expo.unregistered.add('bartek-phone')
      await claimSuggestion()

      expo.failing = true
      await assert.rejects(checkPushReceipts(later(RECEIPT_DELAY_MS)))
      expo.failing = false
      await checkPushReceipts(later(RECEIPT_DELAY_MS))

      assert.deepStrictEqual(await expoTokensOf(users.bartek), [])
    })

    it('stop being asked for once Expo has dropped them, a day on', async function () {
      await addDevice(users.bartek, 'bartek-phone')
      await claimSuggestion()
      expo.notReady.add('ticket-1')

      await checkPushReceipts(later(25 * 60 * 60 * 1000))
      await checkPushReceipts(later(26 * 60 * 60 * 1000))

      assert.deepStrictEqual(expo.receiptRequests, [['ticket-1']])
    })

    it('aren’t needed for a device refused at the send: it goes straight away', async function () {
      await addDevice(users.bartek, 'bartek-phone')
      expo.refusedAtSend.add('bartek-phone')

      await claimSuggestion()

      assert.deepStrictEqual(await expoTokensOf(users.bartek), [])
    })
  })
})
