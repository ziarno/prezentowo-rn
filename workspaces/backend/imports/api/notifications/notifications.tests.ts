import type { NotificationDoc } from '@prezentowo/types'
import assert from 'assert'

import { addGiftAs, createFamilyEvent } from '../../../tests/fixtures'
import {
  callAsUser,
  rejectsWithReason,
  resetDatabase,
  subscribeAsUser,
} from '../../../tests/helpers'
import { Events } from '../events/events.collection'
import { Invites, createInviteIndexes } from '../invites/invites.collection'
import '../invites/invites.methods'
import {
  Notifications,
  createNotificationIndexes,
} from './notifications.collection'
import './notifications.methods'
import './notifications.publications'

const of = (userId: string) =>
  Notifications.find({ userId }, { sort: { createdAt: 1 } }).fetchAsync()

const countAll = () => Notifications.find({}).countAsync()

describe('notifications', function () {
  let family: Awaited<ReturnType<typeof createFamilyEvent>>

  before(async function () {
    await createInviteIndexes()
    await createNotificationIndexes()
  })

  beforeEach(async function () {
    await resetDatabase()
    family = await createFamilyEvent()
  })

  describe('invites.ignore / events.join', function () {
    const codeOf = async () =>
      (await Invites.findOneAsync({ eventId: family.eventId }))!.code

    it('upserts invite-deferred for the ignorer', async function () {
      const { users, eventId } = family
      await callAsUser(users.outsider, 'invites.ignore', {
        code: await codeOf(),
      })

      const [item, ...rest] = await of(users.outsider)
      assert.deepStrictEqual(rest, [])
      assert.strictEqual(item?.kind, 'invite-deferred')
      assert.strictEqual(item?.eventId, eventId)
      assert.strictEqual(item?.read, false)
      assert.ok(item?.createdAt instanceof Date)
      assert.strictEqual(await countAll(), 1)
    })

    it('is idempotent, and keeps the first one', async function () {
      const { users } = family
      const code = await codeOf()
      await callAsUser(users.outsider, 'invites.ignore', { code })
      const [first] = await of(users.outsider)
      await callAsUser(users.outsider, 'notifications.markAllRead')
      await callAsUser(users.outsider, 'invites.ignore', { code })

      const all = await of(users.outsider)
      assert.strictEqual(all.length, 1)
      assert.strictEqual(all[0]?._id, first?._id)
      assert.strictEqual(all[0]?.read, true)
    })

    it('is idempotent under concurrent ignores', async function () {
      const { users } = family
      const code = await codeOf()
      await Promise.all(
        [1, 2, 3].map(() =>
          callAsUser(users.outsider, 'invites.ignore', { code }),
        ),
      )
      assert.strictEqual((await of(users.outsider)).length, 1)
    })

    it('writes nothing for someone already in the event', async function () {
      await callAsUser(family.users.bartek, 'invites.ignore', {
        code: await codeOf(),
      })
      assert.strictEqual(await countAll(), 0)
    })

    it('does not touch the invite', async function () {
      const code = await codeOf()
      await callAsUser(family.users.outsider, 'invites.ignore', { code })
      assert.strictEqual(await codeOf(), code)
    })

    it('is deleted when the ignorer joins', async function () {
      const { users, eventId } = family
      const code = await codeOf()
      await callAsUser(users.outsider, 'invites.ignore', { code })
      await callAsUser(users.outsider, 'events.join', { code })

      const mine = await of(users.outsider)
      assert.deepStrictEqual(mine, [])
      assert.ok(await Events.findOneAsync(eventId))
    })

    it('keeps a deferred invite to a different event', async function () {
      const { users } = family
      const other = await callAsUser<{ _id: string }>(
        users.ola,
        'events.create',
        {
          title: 'Other',
          date: '2026-12-25',
          type: 'many-to-many',
          participants: [],
        },
      )
      const otherCode = (await Invites.findOneAsync({ eventId: other._id }))!
        .code
      await callAsUser(users.outsider, 'invites.ignore', { code: otherCode })
      await callAsUser(users.outsider, 'events.join', { code: await codeOf() })

      const [item] = await of(users.outsider)
      assert.strictEqual(item?.eventId, other._id)
    })

    it('writes participant-joined to the creator only', async function () {
      const { users, eventId } = family
      await callAsUser(users.outsider, 'events.join', { code: await codeOf() })

      const joined = (await Events.findOneAsync(eventId))!.participants.find(
        p => p.kind === 'real' && p.userId === users.outsider,
      )!
      const [item, ...rest] = await of(users.ola)
      assert.deepStrictEqual(rest, [])
      assert.strictEqual(item?.kind, 'participant-joined')
      assert.strictEqual(item?.eventId, eventId)
      assert.strictEqual(item?.joinedParticipantId, joined.id)
      assert.strictEqual(await countAll(), 1)
    })

    it('writes nothing for a rejected join', async function () {
      await rejectsWithReason(
        callAsUser(family.users.bartek, 'events.join', {
          code: await codeOf(),
        }),
        'alreadyAParticipant',
      )
      assert.strictEqual(await countAll(), 0)
    })
  })

  describe('gifts.claim', function () {
    it('notifies the suggester, with the snapshots', async function () {
      const { users, participants, eventId } = family
      const giftId = await addGiftAs(
        users.ola,
        eventId,
        participants.bartek,
        'Scarf',
      )
      await callAsUser(users.celina, 'gifts.claim', { giftId })

      const [item, ...rest] = await of(users.ola)
      assert.deepStrictEqual(rest, [])
      assert.strictEqual(item?.kind, 'suggestion-claimed')
      assert.strictEqual(item?.eventId, eventId)
      assert.strictEqual(item?.giftId, giftId)
      assert.strictEqual(item?.giftTitle, 'Scarf')
      assert.strictEqual(item?.recipientParticipantId, participants.bartek)
      assert.strictEqual(item?.claimedByParticipantId, participants.celina)
      assert.strictEqual(item?.read, false)
      assert.strictEqual(await countAll(), 1)
    })

    it('notifies for a gift suggested for a placeholder', async function () {
      const { users, participants, eventId } = family
      const giftId = await addGiftAs(
        users.ola,
        eventId,
        participants.dziadek,
        'Pipe',
      )
      await callAsUser(users.celina, 'gifts.claim', { giftId })

      const [item] = await of(users.ola)
      assert.strictEqual(item?.recipientParticipantId, participants.dziadek)
    })

    it("never notifies for a self-added gift's claim", async function () {
      const { users, participants, eventId } = family
      const giftId = await addGiftAs(
        users.bartek,
        eventId,
        participants.bartek,
        'Book',
      )
      await callAsUser(users.celina, 'gifts.claim', { giftId })

      assert.strictEqual(await countAll(), 0)
    })

    it('does not notify the suggester about their own claim', async function () {
      const { users, participants, eventId } = family
      const giftId = await addGiftAs(
        users.ola,
        eventId,
        participants.bartek,
        'Scarf',
      )
      await callAsUser(users.ola, 'gifts.claim', { giftId })

      assert.strictEqual(await countAll(), 0)
    })

    it('writes one notification for a repeated claim', async function () {
      const { users, participants, eventId } = family
      const giftId = await addGiftAs(
        users.ola,
        eventId,
        participants.bartek,
        'Scarf',
      )
      await callAsUser(users.celina, 'gifts.claim', { giftId })
      await callAsUser(users.celina, 'gifts.claim', { giftId })

      assert.strictEqual(await countAll(), 1)
    })

    it('writes nothing for an unclaim', async function () {
      const { users, participants, eventId } = family
      const giftId = await addGiftAs(
        users.ola,
        eventId,
        participants.bartek,
        'Scarf',
      )
      await callAsUser(users.celina, 'gifts.claim', { giftId })
      await callAsUser(users.celina, 'gifts.unclaim', { giftId })

      assert.strictEqual(await countAll(), 1)
    })
  })

  describe('gifts.remove', function () {
    const claimedByBoth = async () => {
      const { users, participants, eventId } = family
      const giftId = await addGiftAs(
        users.ola,
        eventId,
        participants.dziadek,
        'Pipe',
      )
      await callAsUser(users.bartek, 'gifts.claim', { giftId })
      await callAsUser(users.celina, 'gifts.claim', { giftId })
      await Notifications.removeAsync({})
      return giftId
    }

    it('notifies each claimer except the caller, naming no deleter', async function () {
      const { users, eventId } = family
      const giftId = await claimedByBoth()
      await callAsUser(users.ola, 'gifts.remove', { giftId })

      for (const claimer of [users.bartek, users.celina]) {
        const [item, ...rest] = await of(claimer)
        assert.deepStrictEqual(rest, [])
        const { _id, createdAt, ...fields } = item as NotificationDoc
        assert.ok(_id && createdAt)
        assert.deepStrictEqual(fields, {
          userId: claimer,
          kind: 'claimed-gift-removed',
          read: false,
          eventId,
          giftTitle: 'Pipe',
          recipientParticipantId: family.participants.dziadek,
        })
      }
      assert.strictEqual(await countAll(), 2)
    })

    it('skips a claimer who is the caller (the gift creator)', async function () {
      const { users } = family
      const giftId = await claimedByBoth()
      await callAsUser(users.ola, 'gifts.claim', { giftId })
      await Notifications.removeAsync({})
      await callAsUser(users.ola, 'gifts.remove', { giftId })

      assert.deepStrictEqual(await of(users.ola), [])
      assert.strictEqual((await of(users.bartek)).length, 1)
      assert.strictEqual((await of(users.celina)).length, 1)
    })

    it('writes nothing for an unclaimed gift', async function () {
      const { users, participants, eventId } = family
      const giftId = await addGiftAs(
        users.ola,
        eventId,
        participants.celina,
        'Mug',
      )
      await callAsUser(users.ola, 'gifts.remove', { giftId })

      assert.strictEqual(await countAll(), 0)
    })
  })

  describe('events.removeParticipant', function () {
    it('writes no claimed-gift-removed for the gifts it deletes', async function () {
      const { users, participants, eventId } = family
      const giftId = await addGiftAs(
        users.ola,
        eventId,
        participants.celina,
        'Mug',
      )
      await callAsUser(users.bartek, 'gifts.claim', { giftId })
      await Notifications.removeAsync({})

      await callAsUser(users.ola, 'events.removeParticipant', {
        eventId,
        participantId: participants.celina,
      })

      assert.strictEqual(await countAll(), 0)
    })
  })

  describe('events.delete', function () {
    it("cascades the event's notifications only", async function () {
      const { users, participants, eventId } = family
      const code = (await Invites.findOneAsync({ eventId }))!.code
      await callAsUser(users.outsider, 'invites.ignore', { code })
      const giftId = await addGiftAs(
        users.ola,
        eventId,
        participants.bartek,
        'Scarf',
      )
      await callAsUser(users.celina, 'gifts.claim', { giftId })
      const { _id: otherId } = await callAsUser<{ _id: string }>(
        users.ola,
        'events.create',
        {
          title: 'Other',
          date: '2026-12-25',
          type: 'many-to-many',
          participants: [],
        },
      )
      await Notifications.insertAsync({
        userId: users.ola,
        kind: 'participant-joined',
        eventId: otherId,
        createdAt: new Date(),
        read: false,
      } as NotificationDoc)

      await callAsUser(users.ola, 'events.delete', { eventId })

      const left = await Notifications.find({}).fetchAsync()
      assert.deepStrictEqual(
        left.map(n => n.eventId),
        [otherId],
      )
    })
  })

  describe('notifications.markAllRead', function () {
    it("marks only the caller's unread ones", async function () {
      const { users, participants, eventId } = family
      const giftId = await addGiftAs(
        users.ola,
        eventId,
        participants.bartek,
        'Scarf',
      )
      await callAsUser(users.celina, 'gifts.claim', { giftId })
      await callAsUser(users.outsider, 'events.join', {
        code: (await Invites.findOneAsync({ eventId }))!.code,
      })
      assert.strictEqual((await of(users.ola)).length, 2)

      await callAsUser(users.ola, 'notifications.markAllRead')

      assert.deepStrictEqual(
        (await of(users.ola)).map(n => n.read),
        [true, true],
      )
      assert.strictEqual(
        await Notifications.find({ userId: { $ne: users.ola } }).countAsync(),
        0,
      )
    })

    it("leaves other users' notifications unread", async function () {
      const { users, eventId } = family
      const code = (await Invites.findOneAsync({ eventId }))!.code
      await callAsUser(users.outsider, 'invites.ignore', { code })
      await callAsUser(users.ola, 'notifications.markAllRead')

      assert.strictEqual((await of(users.outsider))[0]?.read, false)
    })

    it('requires a signed-in caller', async function () {
      await rejectsWithReason(
        callAsUser(null, 'notifications.markAllRead'),
        'mustBeLoggedIn',
      )
    })
  })

  describe('notifications.mine', function () {
    it("publishes only the caller's, newest first, capped at 50", async function () {
      const { users, eventId } = family
      const base = Date.now()
      const docs = Array.from({ length: 55 }, (_, i) => ({
        userId: users.ola,
        kind: 'participant-joined' as const,
        eventId,
        read: false,
        createdAt: new Date(base + i),
      }))
      for (const doc of docs) {
        await Notifications.insertAsync(doc as NotificationDoc)
      }
      await Notifications.insertAsync({
        userId: users.bartek,
        kind: 'participant-joined',
        eventId,
        read: false,
        createdAt: new Date(base),
      } as NotificationDoc)

      const sub = await subscribeAsUser(users.ola, 'notifications.mine')
      try {
        const published = [...sub.docs('notifications').values()]
        assert.strictEqual(published.length, 50)
        assert.ok(published.every(n => n.userId === users.ola))
        const oldest = Math.min(
          ...published.map(n => (n.createdAt as Date).getTime()),
        )
        assert.strictEqual(oldest, base + 5)
      } finally {
        sub.stop()
      }
    })

    it('publishes nothing signed out', async function () {
      const sub = await subscribeAsUser(null, 'notifications.mine')
      try {
        assert.strictEqual(sub.docs('notifications').size, 0)
      } finally {
        sub.stop()
      }
    })
  })
})
