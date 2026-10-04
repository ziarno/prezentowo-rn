import type {
  ImageRef,
  InvitePreview,
  NotificationDoc,
} from '@prezentowo/types'
import assert from 'assert'
import { Meteor } from 'meteor/meteor'

import { createFamilyEvent, createUser } from '../../../tests/fixtures'
import {
  callAsUser,
  resetDatabase,
  subscribeAsUser,
  waitFor,
} from '../../../tests/helpers'
import { Events } from '../events/events.collection'
import {
  Notifications,
  createNotificationIndexes,
} from '../notifications/notifications.collection'
import { Invites, createInviteIndexes } from './invites.collection'
import './invites.methods'
import { loadInvitePreview } from './invites.preview'
import './invites.publications'

describe('invite publications', function () {
  let family: Awaited<ReturnType<typeof createFamilyEvent>>
  let code: string
  const subs: { stop: () => void }[] = []

  const subscribe = async (
    userId: string | null,
    name: string,
    ...args: unknown[]
  ) => {
    const sub = await subscribeAsUser(userId, name, ...args)
    subs.push(sub)
    return sub
  }

  before(async function () {
    await createInviteIndexes()
    await createNotificationIndexes()
  })

  beforeEach(async function () {
    await resetDatabase()
    family = await createFamilyEvent()
    code = (await Invites.findOneAsync({ eventId: family.eventId }))!.code
  })

  afterEach(function () {
    subs.splice(0).forEach(sub => sub.stop())
  })

  describe('invites.byCode', function () {
    it('shows a signed-out viewer the preview and nothing else', async function () {
      const sub = await subscribe(null, 'invites.byCode', code)

      assert.deepStrictEqual(sub.messages, [
        {
          msg: 'added',
          collection: 'invitePreviews',
          id: code,
          fields: {
            code,
            eventId: family.eventId,
            title: 'Wigilia',
            date: '2026-12-24',
            inviterName: 'Ola',
            realParticipants: [
              { id: family.participants.ola, name: 'Ola' },
              { id: family.participants.bartek, name: 'Bartek' },
              { id: family.participants.celina, name: 'Celina' },
            ],
            unclaimedPlaceholders: [
              {
                id: family.participants.dziadek,
                name: 'Dziadek',
                color: '#c33',
              },
            ],
          },
        },
      ])
    })

    it('includes the background when the event has one', async function () {
      const background: ImageRef = { kind: 'illustration', id: 'b3' }
      await Events.updateAsync(family.eventId, { $set: { background } })

      const sub = await subscribe(null, 'invites.byCode', code)

      assert.deepStrictEqual(
        sub.docs('invitePreviews').get(code)?.background,
        background,
      )
    })

    it('publishes nothing for an unknown code', async function () {
      const sub = await subscribe(null, 'invites.byCode', 'ZZZZ')

      assert.deepStrictEqual(sub.messages, [])
    })

    it('drops a placeholder from the list once someone claims it', async function () {
      const sub = await subscribe(null, 'invites.byCode', code)
      const newcomer = await createUser('Newcomer')

      await callAsUser(newcomer, 'events.join', {
        code,
        participantId: family.participants.dziadek,
      })

      await waitFor(
        () =>
          (
            sub.docs('invitePreviews').get(code)
              ?.unclaimedPlaceholders as unknown[]
          )?.length === 0,
      )
    })

    it('lists someone who joins among those taking part', async function () {
      const sub = await subscribe(null, 'invites.byCode', code)
      const newcomer = await createUser('Newcomer')
      await Meteor.users.updateAsync(newcomer, {
        $set: { 'profile.avatar': 'f2', 'profile.photo': 'photo-id' },
      })

      await callAsUser(newcomer, 'events.join', { code })

      await waitFor(() => {
        const taking = sub.docs('invitePreviews').get(code)
          ?.realParticipants as InvitePreview['realParticipants']
        return taking?.some(
          p =>
            p.name === 'Newcomer' &&
            p.avatar === 'f2' &&
            p.photo === 'photo-id',
        )
      })
    })

    it('follows a change to the event title', async function () {
      const sub = await subscribe(null, 'invites.byCode', code)

      await Events.updateAsync(family.eventId, { $set: { title: 'Święta' } })

      await waitFor(
        () => sub.docs('invitePreviews').get(code)?.title === 'Święta',
      )
    })

    it('removes the preview once the code is rotated away', async function () {
      const sub = await subscribe(null, 'invites.byCode', code)

      await Invites.updateAsync({ code }, { $set: { code: 'Rot8' } })

      await waitFor(() => !sub.docs('invitePreviews').has(code))
    })
  })

  describe('invites.forEvent', function () {
    it("sends the creator the event's invite", async function () {
      const sub = await subscribe(
        family.users.ola,
        'invites.forEvent',
        family.eventId,
      )

      const invites = [...sub.docs('invites').values()]
      assert.strictEqual(invites.length, 1)
      assert.strictEqual(invites[0]!.code, code)
      assert.strictEqual(invites[0]!.eventId, family.eventId)
    })

    it('sends nothing to anyone but the creator', async function () {
      for (const userId of [family.users.bartek, family.users.outsider, null]) {
        const sub = await subscribe(userId, 'invites.forEvent', family.eventId)
        assert.deepStrictEqual(sub.messages, [], String(userId))
      }
    })
  })
  describe('invites.deferred', function () {
    const ignore = (userId: string) =>
      callAsUser(userId, 'invites.ignore', { code })

    it('sends what the inbox shows of an invite the caller set aside', async function () {
      await ignore(family.users.outsider)

      const sub = await subscribe(family.users.outsider, 'invites.deferred')

      assert.deepStrictEqual(sub.messages, [
        {
          msg: 'added',
          collection: 'deferredInvites',
          id: family.eventId,
          fields: {
            eventId: family.eventId,
            code,
            title: 'Wigilia',
            inviterName: 'Ola',
          },
        },
      ])
    })

    it('sends nothing for invites the caller never set aside', async function () {
      await ignore(family.users.outsider)
      const stranger = await createUser('Stranger')

      for (const userId of [stranger, family.users.bartek, null]) {
        const sub = await subscribe(userId, 'invites.deferred')
        assert.deepStrictEqual(sub.messages, [], String(userId))
      }
    })

    it('follows the code when the creator rotates it', async function () {
      await ignore(family.users.outsider)
      const sub = await subscribe(family.users.outsider, 'invites.deferred')

      await Invites.updateAsync({ code }, { $set: { code: 'Rot8' } })

      await waitFor(
        () => sub.docs('deferredInvites').get(family.eventId)?.code === 'Rot8',
      )
    })

    it('adds an invite set aside while subscribed', async function () {
      const sub = await subscribe(family.users.outsider, 'invites.deferred')

      await ignore(family.users.outsider)

      await waitFor(() => sub.docs('deferredInvites').has(family.eventId))
    })

    it('drops the invite once the caller joins', async function () {
      await ignore(family.users.outsider)
      const sub = await subscribe(family.users.outsider, 'invites.deferred')

      await callAsUser(family.users.outsider, 'events.join', { code })

      await waitFor(() => !sub.docs('deferredInvites').has(family.eventId))
    })

    describe('for an invitation from `4d`', function () {
      let invitedTo: { eventId: string; code: string }

      beforeEach(async function () {
        const { _id: eventId } = await callAsUser<{ _id: string }>(
          family.users.ola,
          'events.create',
          {
            title: 'Imieniny',
            date: '2026-06-01',
            type: 'many-to-many',
            participants: [
              { kind: 'invited', userId: family.users.outsider, color: '#3c3' },
            ],
          },
        )
        invitedTo = {
          eventId,
          code: (await Invites.findOneAsync({ eventId }))!.code,
        }
      })

      it('sends it like a set-aside invite', async function () {
        const sub = await subscribe(family.users.outsider, 'invites.deferred')

        assert.deepStrictEqual(sub.messages, [
          {
            msg: 'added',
            collection: 'deferredInvites',
            id: invitedTo.eventId,
            fields: {
              eventId: invitedTo.eventId,
              code: invitedTo.code,
              title: 'Imieniny',
              inviterName: 'Ola',
            },
          },
        ])
      })

      it('sends one per event alongside a set-aside invite, until the last goes', async function () {
        const { outsider } = family.users
        // As if set aside before the reservation existed.
        await Notifications.insertAsync({
          userId: outsider,
          kind: 'invite-deferred',
          eventId: invitedTo.eventId,
          createdAt: new Date(),
          read: false,
        } as NotificationDoc)

        const sub = await subscribe(outsider, 'invites.deferred')
        assert.strictEqual(
          sub.messages.filter(m => m.id === invitedTo.eventId).length,
          1,
        )

        await Notifications.removeAsync({
          userId: outsider,
          eventId: invitedTo.eventId,
          kind: 'invite-deferred',
        })
        await new Promise(resolve => setTimeout(resolve, 100))
        assert.ok(sub.docs('deferredInvites').has(invitedTo.eventId))

        await callAsUser(outsider, 'events.join', { code: invitedTo.code })
        await waitFor(() => !sub.docs('deferredInvites').has(invitedTo.eventId))
      })
    })
  })

  describe('reserved placeholders', function () {
    let invitee: string
    let reservedId: string

    beforeEach(async function () {
      invitee = await createUser('Invitee')
      const { _id: eventId } = await callAsUser<{ _id: string }>(
        family.users.ola,
        'events.create',
        {
          title: 'Imieniny',
          date: '2026-06-01',
          type: 'many-to-many',
          participants: [
            { kind: 'invited', userId: invitee, color: '#3c3' },
            { kind: 'placeholder', name: 'Babcia', color: '#c33' },
          ],
        },
      )
      code = (await Invites.findOneAsync({ eventId }))!.code
      reservedId = (await Events.findOneAsync(eventId))!.participants[1]!.id
    })

    const placeholdersFor = async (userId: string | null) => {
      const sub = await subscribe(userId, 'invites.byCode', code)
      return sub.docs('invitePreviews').get(code)?.unclaimedPlaceholders
    }

    it("lists the viewer's own reservation, marked reservedForYou", async function () {
      const placeholders = (await placeholdersFor(invitee)) as {
        name: string
      }[]

      assert.deepStrictEqual(
        placeholders.map(p => p.name),
        ['Invitee', 'Babcia'],
      )
      assert.deepStrictEqual(placeholders[0], {
        id: reservedId,
        name: 'Invitee',
        color: '#3c3',
        reservedForYou: true,
      })
    })

    it('leaves it out for anyone else, signed in or out', async function () {
      for (const userId of [family.users.outsider, family.users.ola, null]) {
        const placeholders = (await placeholdersFor(userId)) as {
          name: string
        }[]
        assert.deepStrictEqual(
          placeholders.map(p => p.name),
          ['Babcia'],
          String(userId),
        )
      }
    })

    it('never sends invitedUserId', async function () {
      const sub = await subscribe(invitee, 'invites.byCode', code)

      assert.ok(!JSON.stringify(sub.messages).includes('invitedUserId'))
      assert.ok(!JSON.stringify(sub.messages).includes(invitee))
    })

    it('leaves it out of the web landing page', async function () {
      const preview = await loadInvitePreview(code)

      assert.deepStrictEqual(
        preview?.unclaimedPlaceholders.map(p => p.name),
        ['Babcia'],
      )
    })
  })
})
