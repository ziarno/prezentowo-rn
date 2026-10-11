import type {
  EventDoc,
  EventParticipant,
  InvitePreview,
  NotificationDoc,
} from '@prezentowo/types'
import assert from 'assert'
import { Meteor } from 'meteor/meteor'
import { Random } from 'meteor/random'

import { useFakeChatServer } from '../../../tests/chat'
import {
  addGiftAs,
  createEventWithMembers,
  createFamilyEvent,
  createUser,
} from '../../../tests/fixtures'
import {
  callAsUser,
  rejectsWithReason,
  resetDatabase,
  subscribeAsUser,
  whileFailing,
} from '../../../tests/helpers'
import { isStored, uploadAs, useImagesSandbox } from '../../../tests/images'
import { Activity } from '../activity/activity.collection'
import { ChatThreads } from '../chat/chat.collection'
import '../chat/chat.methods'
import { Events } from '../events/events.collection'
import '../events/events.methods'
import '../events/events.publications'
import { Gifts, createGiftIndexes } from '../gifts/gifts.collection'
import { Invites, createInviteIndexes } from '../invites/invites.collection'
import '../invites/invites.methods'
import '../invites/invites.publications'
import {
  Notifications,
  createNotificationIndexes,
} from '../notifications/notifications.collection'
import { deleteAccountFor, departedColor } from './users.deleteAccount'

type Placeholder = Extract<EventParticipant, { kind: 'placeholder' }>

const eventOf = async (eventId: string) =>
  (await Events.findOneAsync(eventId)) as EventDoc

const participantOf = async (eventId: string, participantId: string) =>
  (await eventOf(eventId)).participants.find(p => p.id === participantId)

const placeholderOf = async (eventId: string, participantId: string) => {
  const participant = await participantOf(eventId, participantId)
  assert.strictEqual(participant?.kind, 'placeholder')
  return participant as Placeholder
}

const userExists = async (userId: string) =>
  !!(await Meteor.users.findOneAsync(userId, { fields: { _id: 1 } }))

const notificationsOf = (userId: string, kind?: NotificationDoc['kind']) =>
  Notifications.find({ userId, ...(kind ? { kind } : {}) }).fetchAsync()

describe('users.deleteAccount', function () {
  const stream = useFakeChatServer()
  useImagesSandbox()

  let family: Awaited<ReturnType<typeof createFamilyEvent>>

  const deleteAccount = (userId: string | null, email: string) =>
    callAsUser(userId, 'users.deleteAccount', { email })

  before(async function () {
    await createInviteIndexes()
    await createNotificationIndexes()
    await createGiftIndexes()
  })

  beforeEach(async function () {
    await resetDatabase()
    family = await createFamilyEvent()
  })

  describe('the email check', function () {
    it('is for signed-in users only', async function () {
      await rejectsWithReason(
        deleteAccount(null, 'ola@example.com'),
        'mustBeLoggedIn',
      )
    })

    it('rejects an email that is not the account’s, deleting nothing', async function () {
      await assert.rejects(
        deleteAccount(family.users.ola, 'bartek@example.com'),
        (e: Meteor.Error) => {
          assert.strictEqual(e.error, 'notAuthorized')
          assert.strictEqual(e.reason, 'emailMismatch')
          return true
        },
      )
      assert.ok(await userExists(family.users.ola))
      assert.strictEqual(
        (await eventOf(family.eventId)).ownerId,
        family.users.ola,
      )
    })

    it('rejects an empty email', async function () {
      await rejectsWithReason(
        deleteAccount(family.users.ola, ''),
        'emailMismatch',
      )
      assert.ok(await userExists(family.users.ola))
    })

    it('matches case-insensitively, ignoring surrounding spaces', async function () {
      await deleteAccount(family.users.ola, '  OLA@Example.com ')
      assert.strictEqual(await userExists(family.users.ola), false)
    })

    it('rejects arguments of the wrong shape', async function () {
      await assert.rejects(
        callAsUser(family.users.ola, 'users.deleteAccount', { email: 7 }),
      )
      assert.ok(await userExists(family.users.ola))
    })
  })

  describe('events you created', function () {
    it('hands one over to the earliest-joined remaining real participant', async function () {
      const { ola, bartek, celina } = family.users
      await deleteAccount(ola, 'ola@example.com')

      const event = await eventOf(family.eventId)
      assert.strictEqual(event.ownerId, bartek)
      const invite = await Invites.findOneAsync({ eventId: family.eventId })
      assert.strictEqual(invite?.ownerId, bartek)
      assert.strictEqual(
        (await notificationsOf(bartek, 'event-handed-over')).length,
        1,
      )
      assert.strictEqual((await notificationsOf(celina)).length, 0)
    })

    it('skips a placeholder that joined earlier in the list', async function () {
      // Dziadek sits after the real participants; the order of `participants`
      // is the order of joining, so Bartek (first real one left) inherits.
      const { ola, bartek } = family.users
      const event = await eventOf(family.eventId)
      const [host, ...rest] = event.participants
      const dziadek = rest.find(p => p.kind === 'placeholder')!
      await Events.updateAsync(family.eventId, {
        $set: {
          participants: [host!, dziadek, ...rest.filter(p => p !== dziadek)],
        },
      })

      await deleteAccount(ola, 'ola@example.com')

      assert.strictEqual((await eventOf(family.eventId)).ownerId, bartek)
    })

    it('gives the new creator the event-handed-over notification, unread, for that event', async function () {
      await deleteAccount(family.users.ola, 'ola@example.com')

      const [handed] = await notificationsOf(
        family.users.bartek,
        'event-handed-over',
      )
      assert.strictEqual(handed?.eventId, family.eventId)
      assert.strictEqual(handed?.read, false)
    })

    it('lets the new creator act as the creator', async function () {
      await deleteAccount(family.users.ola, 'ola@example.com')

      await callAsUser(family.users.bartek, 'events.update', {
        eventId: family.eventId,
        title: 'Nowa Wigilia',
      })
      assert.strictEqual((await eventOf(family.eventId)).title, 'Nowa Wigilia')
    })

    it('deletes one with nobody else real, with events.delete’s cascade', async function () {
      const { ola } = family.users
      const { _id: alone } = await callAsUser<{ _id: string }>(
        ola,
        'events.create',
        {
          title: 'Sam',
          date: '2026-06-01',
          type: 'many-to-many',
          participants: [{ kind: 'placeholder', name: 'Kuzyn', color: '#333' }],
        },
      )
      const kuzyn = (await eventOf(alone)).participants.find(
        p => p.kind === 'placeholder',
      )!.id
      const giftId = await addGiftAs(ola, alone, kuzyn, 'Książka')
      assert.ok(await Activity.findOneAsync({ eventId: alone }))
      assert.ok(await ChatThreads.findOneAsync({ eventId: alone }))

      await deleteAccount(ola, 'ola@example.com')

      assert.strictEqual(await Events.findOneAsync(alone), undefined)
      assert.strictEqual(
        await Invites.findOneAsync({ eventId: alone }),
        undefined,
      )
      assert.strictEqual(await Gifts.findOneAsync(giftId), undefined)
      assert.strictEqual(
        await Activity.findOneAsync({ eventId: alone }),
        undefined,
      )
      assert.strictEqual(
        await ChatThreads.findOneAsync({ eventId: alone }),
        undefined,
      )
    })

    it('deletes one where the only other people are placeholders', async function () {
      const { ola } = family.users
      const { _id: eventId } = await callAsUser<{ _id: string }>(
        ola,
        'events.create',
        {
          title: 'Sam',
          date: '2026-06-01',
          type: 'many-to-many',
          participants: [{ kind: 'placeholder', name: 'Kuzyn', color: '#333' }],
        },
      )
      await deleteAccount(ola, 'ola@example.com')
      assert.strictEqual(await Events.findOneAsync(eventId), undefined)
      assert.strictEqual(
        await Notifications.findOneAsync({ eventId }),
        undefined,
        'nobody is told about an event that is gone',
      )
    })

    it('hands over several, each to its own earliest member', async function () {
      const { ola, bartek, celina } = family.users
      const second = await createEventWithMembers(
        ola,
        [celina, bartek],
        'Druga',
      )

      await deleteAccount(ola, 'ola@example.com')

      assert.strictEqual((await eventOf(family.eventId)).ownerId, bartek)
      assert.strictEqual((await eventOf(second)).ownerId, celina)
    })
  })

  describe('the departed placeholder', function () {
    it('keeps the participant id and takes the profile’s name and stock avatar', async function () {
      const { ola } = family.users
      await Meteor.users.updateAsync(ola, { $set: { 'profile.avatar': 'f3' } })

      await deleteAccount(ola, 'ola@example.com')

      const departed = await placeholderOf(
        family.eventId,
        family.participants.ola,
      )
      assert.strictEqual(departed.name, 'Ola')
      assert.strictEqual(departed.avatar, 'f3')
      assert.strictEqual(departed.departedUserId, ola)
      assert.ok(!('photo' in departed))
      assert.ok(!('invitedUserId' in departed))
    })

    it('has no avatar when the profile had none, and never a photo', async function () {
      const { bartek } = family.users
      const photo = await uploadAs(bartek)
      await Meteor.users.updateAsync(bartek, {
        $set: { 'profile.photo': photo.id },
      })

      await deleteAccount(bartek, 'bartek@example.com')

      const departed = await placeholderOf(
        family.eventId,
        family.participants.bartek,
      )
      assert.ok(!('avatar' in departed))
      assert.ok(!('photo' in departed))
    })

    it('has a colour from the id alone', async function () {
      await deleteAccount(family.users.bartek, 'bartek@example.com')

      const departed = await placeholderOf(
        family.eventId,
        family.participants.bartek,
      )
      assert.strictEqual(
        departed.color,
        departedColor(family.participants.bartek),
      )
      assert.strictEqual(departedColor('abc'), departedColor('abc'))
      assert.match(departed.color, /^#[0-9a-f]{6}$/i)
    })

    it('becomes one in every event the account was in, handed-over ones included', async function () {
      const { ola, bartek } = family.users
      const second = await createEventWithMembers(bartek, [ola], 'Druga')

      await deleteAccount(ola, 'ola@example.com')

      for (const eventId of [family.eventId, second]) {
        const event = await eventOf(eventId)
        assert.ok(
          event.participants.some(
            p => p.kind === 'placeholder' && p.departedUserId === ola,
          ),
        )
        assert.ok(
          !event.participants.some(p => p.kind === 'real' && p.userId === ola),
        )
      }
    })

    it('keeps gifts, activity and the other participants as they were', async function () {
      const { ola } = family.users
      const { ola: pOla, bartek: pBartek } = family.participants
      const wish = await addGiftAs(ola, family.eventId, pOla, 'Szalik')
      const forBartek = await addGiftAs(ola, family.eventId, pBartek, 'Książka')
      const activityBefore = await Activity.find({
        eventId: family.eventId,
      }).countAsync()

      await deleteAccount(ola, 'ola@example.com')

      const gifts = await Gifts.find({ eventId: family.eventId }).fetchAsync()
      assert.deepStrictEqual(
        gifts.map(g => g._id).sort(),
        [wish, forBartek].sort(),
      )
      assert.strictEqual((await Gifts.findOneAsync(wish))!.createdBy, ola)
      assert.strictEqual((await Gifts.findOneAsync(forBartek))!.createdBy, ola)
      assert.strictEqual(
        await Activity.find({ eventId: family.eventId }).countAsync(),
        activityBefore,
      )
      assert.ok(await participantOf(family.eventId, pBartek))
    })

    it('lets a many-to-one event survive its beneficiary', async function () {
      const { ola, bartek } = family.users
      const { _id: eventId } = await callAsUser<{ _id: string }>(
        ola,
        'events.create',
        {
          title: 'Urodziny Bartka',
          date: '2026-11-02',
          type: 'many-to-one',
          beneficiaryIndex: 1,
          participants: [
            { kind: 'real', userId: ola },
            { kind: 'placeholder', name: 'Dziadek', color: '#333' },
          ],
        },
      )
      // Make Bartek the beneficiary: a real participant after Ola.
      const event = await eventOf(eventId)
      const bartekId = Random.id()
      await Events.updateAsync(eventId, {
        $set: {
          participants: [
            ...event.participants,
            { id: bartekId, kind: 'real', userId: bartek },
          ],
          beneficiaryParticipantId: bartekId,
        },
      })

      await deleteAccount(bartek, 'bartek@example.com')

      const after = await eventOf(eventId)
      assert.strictEqual(after.type, 'many-to-one')
      assert.strictEqual(
        (after as Extract<EventDoc, { type: 'many-to-one' }>)
          .beneficiaryParticipantId,
        bartekId,
      )
      assert.strictEqual(
        (await placeholderOf(eventId, bartekId)).departedUserId,
        bartek,
      )
    })

    it('can never be claimed: events.join answers notFound, as for a missing one', async function () {
      const { ola, outsider } = family.users
      await deleteAccount(ola, 'ola@example.com')
      const { code } = (await Invites.findOneAsync({
        eventId: family.eventId,
      }))!

      await assert.rejects(
        callAsUser(outsider, 'events.join', {
          code,
          participantId: family.participants.ola,
        }),
        (e: Meteor.Error) => {
          assert.strictEqual(e.error, 'notFound')
          assert.strictEqual(e.reason, 'placeholderNotFound')
          return true
        },
      )
      const unchanged = await placeholderOf(
        family.eventId,
        family.participants.ola,
      )
      assert.strictEqual(unchanged.departedUserId, ola)
      assert.strictEqual(
        (await eventOf(family.eventId)).participants.some(
          p => p.kind === 'real' && p.userId === outsider,
        ),
        false,
      )
    })

    it('is left out of invites.byCode, which still lists the claimable ones', async function () {
      await deleteAccount(family.users.ola, 'ola@example.com')
      const { code } = (await Invites.findOneAsync({
        eventId: family.eventId,
      }))!

      const sub = await subscribeAsUser(null, 'invites.byCode', code)
      try {
        const preview = [
          ...sub.docs('invitePreviews').values(),
        ][0] as unknown as InvitePreview
        assert.deepStrictEqual(
          preview.unclaimedPlaceholders.map(p => p.name),
          ['Dziadek'],
        )
        assert.ok(!JSON.stringify(sub.messages).includes('departedUserId'))
      } finally {
        sub.stop()
      }
    })

    it('is published with its departedUserId to the event’s members', async function () {
      const { ola, bartek } = family.users
      await deleteAccount(ola, 'ola@example.com')

      const sub = await subscribeAsUser(bartek, 'events.byId', family.eventId)
      try {
        const event = sub
          .docs('events')
          .get(family.eventId) as unknown as EventDoc
        const departed = event.participants.find(
          p => p.id === family.participants.ola,
        ) as Placeholder
        assert.strictEqual(departed.departedUserId, ola)
      } finally {
        sub.stop()
      }
    })

    it('is like a placeholder added by name: the creator may give it a picture or remove it', async function () {
      const { ola, bartek } = family.users
      await deleteAccount(ola, 'ola@example.com')

      await callAsUser(bartek, 'events.updateParticipant', {
        eventId: family.eventId,
        participantId: family.participants.ola,
        avatar: 'f7',
      })
      assert.strictEqual(
        (await placeholderOf(family.eventId, family.participants.ola)).avatar,
        'f7',
      )

      await callAsUser(bartek, 'events.removeParticipant', {
        eventId: family.eventId,
        participantId: family.participants.ola,
      })
      assert.strictEqual(
        await participantOf(family.eventId, family.participants.ola),
        undefined,
      )
    })
  })

  describe('claims', function () {
    it('are pulled from every gift, silently', async function () {
      const { ola, bartek, celina } = family.users
      const { ola: pOla, celina: pCelina } = family.participants
      const mine = await addGiftAs(ola, family.eventId, pCelina, 'Czapka')
      const shared = await addGiftAs(ola, family.eventId, pOla, 'Szalik')
      await callAsUser(bartek, 'gifts.claim', { giftId: mine })
      await callAsUser(celina, 'gifts.claim', { giftId: shared })
      await callAsUser(bartek, 'gifts.claim', { giftId: shared })
      const othersBefore = (
        await Notifications.find({ userId: { $ne: bartek } }).fetchAsync()
      ).map(n => n._id)

      await deleteAccount(bartek, 'bartek@example.com')

      assert.deepStrictEqual((await Gifts.findOneAsync(mine))!.claimedBy, [])
      assert.deepStrictEqual((await Gifts.findOneAsync(shared))!.claimedBy, [
        celina,
      ])
      // Nothing was sent about it, to the suggester or anyone else.
      assert.deepStrictEqual(
        (
          await Notifications.find({ userId: { $ne: bartek } }).fetchAsync()
        ).map(n => n._id),
        othersBefore,
      )
    })

    it('are pulled from gifts in events that were deleted, without error', async function () {
      const { ola } = family.users
      const { _id: alone } = await callAsUser<{ _id: string }>(
        ola,
        'events.create',
        {
          title: 'Sam',
          date: '2026-06-01',
          type: 'many-to-many',
          participants: [],
        },
      )
      assert.ok(alone)
      await deleteAccount(ola, 'ola@example.com')
      assert.strictEqual(await Events.findOneAsync(alone), undefined)
    })
  })

  describe('chat', function () {
    it('retires the secret thread about the user and removes them from the others', async function () {
      const { ola } = family.users
      await deleteAccount(ola, 'ola@example.com')

      const live = await ChatThreads.find({
        eventId: family.eventId,
        retiredAt: { $exists: false },
      }).fetchAsync()
      assert.deepStrictEqual(live.map(t => t.kind).sort(), [
        'event',
        'secret',
        'secret',
      ])
      for (const thread of live) {
        assert.ok(!stream.membersOf(thread).includes(ola))
      }
      const retired = await ChatThreads.find({
        eventId: family.eventId,
        recipientParticipantId: family.participants.ola,
      }).fetchAsync()
      assert.strictEqual(retired.length, 1)
      assert.ok(retired[0]!.retiredAt)
      assert.ok(stream.isFrozen(retired[0]!))
    })

    it('anonymises the Stream user instead of deleting it', async function () {
      const { ola } = family.users
      await deleteAccount(ola, 'ola@example.com')

      assert.deepStrictEqual(stream.users.get(ola), {
        name: 'Deleted user',
        image: '',
      })
      assert.ok(
        stream.calls.some(c => c.op === 'anonymiseUser' && c.userId === ola),
      )
    })

    it('finishes when chat is off', async function () {
      const { setChatServer } = await import('../chat/chat.server')
      setChatServer(null)
      await deleteAccount(family.users.ola, 'ola@example.com')
      assert.strictEqual(await userExists(family.users.ola), false)
    })

    it('fails, leaving the account in place to retry, while Stream is unreachable', async function () {
      const { ola, bartek } = family.users
      stream.failing = true
      await assert.rejects(deleteAccount(ola, 'ola@example.com'))
      assert.ok(await userExists(ola))

      stream.failing = false
      await deleteAccount(ola, 'ola@example.com')

      assert.strictEqual(await userExists(ola), false)
      const live = await ChatThreads.find({
        eventId: family.eventId,
        retiredAt: { $exists: false },
      }).fetchAsync()
      for (const thread of live) {
        assert.ok(!stream.membersOf(thread).includes(ola))
      }
      assert.strictEqual((await eventOf(family.eventId)).ownerId, bartek)
      assert.strictEqual(
        (await notificationsOf(bartek, 'event-handed-over')).length,
        1,
      )
    })
  })

  describe('reservations for the user', function () {
    it('become ordinary placeholders, name and avatar kept', async function () {
      const { ola, outsider } = family.users
      await Meteor.users.updateAsync(outsider, {
        $set: { 'profile.avatar': 'm2' },
      })
      const { _id: eventId } = await callAsUser<{ _id: string }>(
        ola,
        'events.create',
        {
          title: 'Imprezka',
          date: '2026-06-01',
          type: 'many-to-many',
          participants: [{ kind: 'invited', userId: outsider, color: '#333' }],
        },
      )
      const reserved = (await eventOf(eventId)).participants.find(
        p => p.kind === 'placeholder',
      )!
      assert.strictEqual((reserved as Placeholder).invitedUserId, outsider)

      await deleteAccount(outsider, 'outsider@example.com')

      const after = await placeholderOf(eventId, reserved.id)
      assert.ok(!('invitedUserId' in after))
      assert.ok(!('departedUserId' in after))
      assert.strictEqual(after.name, 'Outsider')
      assert.strictEqual(after.avatar, 'm2')

      // It is claimable by anyone now.
      const joiner = await createUser('Nowy')
      const { code } = (await Invites.findOneAsync({ eventId }))!
      await callAsUser(joiner, 'events.join', {
        code,
        participantId: reserved.id,
      })
      assert.strictEqual(
        (await participantOf(eventId, reserved.id))?.kind,
        'real',
      )
    })
  })

  describe('what belongs to the user alone', function () {
    it('deletes their notifications', async function () {
      const { ola, bartek } = family.users
      await Notifications.insertAsync({
        userId: bartek,
        kind: 'participant-joined',
        eventId: family.eventId,
        createdAt: new Date(),
        read: false,
      } as NotificationDoc)
      await Notifications.insertAsync({
        userId: ola,
        kind: 'participant-joined',
        eventId: family.eventId,
        createdAt: new Date(),
        read: false,
      } as NotificationDoc)

      await deleteAccount(bartek, 'bartek@example.com')

      assert.strictEqual((await notificationsOf(bartek)).length, 0)
      assert.strictEqual((await notificationsOf(ola)).length, 1)
    })

    it('deletes the profile photo and its Images record', async function () {
      const { bartek } = family.users
      const photo = await uploadAs(bartek)
      await Meteor.users.updateAsync(bartek, {
        $set: { 'profile.photo': photo.id },
      })
      assert.ok(await isStored(photo.id))

      await deleteAccount(bartek, 'bartek@example.com')

      assert.strictEqual(await isStored(photo.id), false)
    })

    it('keeps the uploads on gifts that stay', async function () {
      const { bartek } = family.users
      const image = await uploadAs(bartek)
      await addGiftAs(
        bartek,
        family.eventId,
        family.participants.ola,
        'Wazon',
        {
          image,
        },
      )

      await deleteAccount(bartek, 'bartek@example.com')

      assert.ok(await isStored(image.id))
    })

    it('deletes the user document last', async function () {
      const { bartek } = family.users
      await deleteAccount(bartek, 'bartek@example.com')
      assert.strictEqual(await userExists(bartek), false)
      assert.strictEqual(
        await Meteor.users.findOneAsync({
          'emails.address': 'bartek@example.com',
        }),
        undefined,
      )
    })
  })

  describe('deleteAccountFor', function () {
    it('is a no-op for an account that is already gone', async function () {
      await deleteAccountFor('nobody')
    })

    it('can run again after it died half-way, and finishes', async function () {
      const { ola, bartek } = family.users
      const wish = await addGiftAs(
        ola,
        family.eventId,
        family.participants.bartek,
        'Książka',
      )
      await callAsUser(ola, 'gifts.claim', { giftId: wish }).catch(() => {})

      // The notifications step fails: steps 1–6 have run, 7–10 have not.
      await whileFailing(Notifications, 'removeAsync', async () => {
        await assert.rejects(deleteAccountFor(ola))
      })
      assert.ok(await userExists(ola))
      assert.strictEqual((await eventOf(family.eventId)).ownerId, bartek)

      await deleteAccountFor(ola)

      assert.strictEqual(await userExists(ola), false)
      assert.strictEqual((await eventOf(family.eventId)).ownerId, bartek)
      assert.strictEqual(
        (await notificationsOf(bartek, 'event-handed-over')).length,
        1,
        'the hand-over is told once, however often it runs',
      )
      assert.strictEqual(
        (await placeholderOf(family.eventId, family.participants.ola))
          .departedUserId,
        ola,
      )
      assert.strictEqual(
        (await Invites.findOneAsync({ eventId: family.eventId }))!.ownerId,
        bartek,
      )
    })

    it('can run again after dying between the hand-over’s writes', async function () {
      const { ola, bartek } = family.users
      // The event write is the last of the three; fail it once.
      await whileFailing(Events, 'updateAsync', async () => {
        await assert.rejects(deleteAccountFor(ola))
      })
      assert.ok(await userExists(ola))

      await deleteAccountFor(ola)

      assert.strictEqual((await eventOf(family.eventId)).ownerId, bartek)
      assert.strictEqual(
        (await Invites.findOneAsync({ eventId: family.eventId }))!.ownerId,
        bartek,
      )
      assert.strictEqual(
        (await notificationsOf(bartek, 'event-handed-over')).length,
        1,
      )
    })

    it('can run again after dying while deleting an event', async function () {
      const { ola } = family.users
      const { _id: alone } = await callAsUser<{ _id: string }>(
        ola,
        'events.create',
        {
          title: 'Sam',
          date: '2026-06-01',
          type: 'many-to-many',
          participants: [],
        },
      )
      const giftId = await addGiftAs(
        ola,
        alone,
        (await eventOf(alone)).participants[0]!.id,
        'Książka',
      )

      await whileFailing(Events, 'removeAsync', async () => {
        await assert.rejects(deleteAccountFor(ola))
      })
      await deleteAccountFor(ola)

      assert.strictEqual(await Events.findOneAsync(alone), undefined)
      assert.strictEqual(await Gifts.findOneAsync(giftId), undefined)
      assert.strictEqual(await userExists(ola), false)
    })
  })
})
