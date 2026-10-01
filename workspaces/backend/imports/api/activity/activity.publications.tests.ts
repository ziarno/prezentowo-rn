import type { ActivityDoc } from '@prezentowo/types'
import assert from 'assert'

import {
  addGiftAs,
  createFamilyEvent,
  createUser,
} from '../../../tests/fixtures'
import {
  callAsUser,
  resetDatabase,
  subscribeAsUser,
  waitFor,
} from '../../../tests/helpers'
import { Invites, createInviteIndexes } from '../invites/invites.collection'
import { Activity } from './activity.collection'
import './activity.publications'

type Sub = Awaited<ReturnType<typeof subscribeAsUser>>

const giftTitles = (sub: Sub) =>
  [...sub.docs('activity').values()].map(a => a.giftTitle).sort()

const leaksHiddenFrom = (sub: Sub) =>
  sub.messages.some(m => 'fields' in m && 'hiddenFromParticipantId' in m.fields)

// Every item an activity publication could hold for this event: a self-added
// gift, a suggested one and a claim, all about Bartek.
const seedAboutBartek = async (
  family: Awaited<ReturnType<typeof createFamilyEvent>>,
) => {
  const { users, participants, eventId } = family
  const own = await addGiftAs(
    users.bartek,
    eventId,
    participants.bartek,
    'Book',
  )
  await addGiftAs(users.ola, eventId, participants.bartek, 'Scarf')
  await callAsUser(users.celina, 'gifts.claim', { giftId: own })
}

describe('activity publications', function () {
  let family: Awaited<ReturnType<typeof createFamilyEvent>>
  const subs: Sub[] = []

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
  })

  beforeEach(async function () {
    await resetDatabase()
    family = await createFamilyEvent()
  })

  afterEach(function () {
    subs.splice(0).forEach(sub => sub.stop())
  })

  describe('activity.byEvent', function () {
    const subscribeTo = (userId: string | null) =>
      subscribe(userId, 'activity.byEvent', family.eventId)

    it('hides a suggestion and every claim from their recipient', async function () {
      await seedAboutBartek(family)

      const sub = await subscribeTo(family.users.bartek)

      const kinds = [...sub.docs('activity').values()].map(a => a.kind)
      assert.deepStrictEqual(kinds, ['gift-added'])
      assert.deepStrictEqual(giftTitles(sub), ['Book'])
    })

    it('shows everyone else every item', async function () {
      await seedAboutBartek(family)

      const sub = await subscribeTo(family.users.celina)

      assert.deepStrictEqual(giftTitles(sub), ['Book', 'Book', 'Scarf'])
    })

    it('never publishes hiddenFromParticipantId', async function () {
      await seedAboutBartek(family)

      const sub = await subscribeTo(family.users.celina)

      assert.strictEqual(sub.docs('activity').size, 3)
      assert.strictEqual(leaksHiddenFrom(sub), false)
    })

    it('keeps applying the filter to live items', async function () {
      const { users, participants, eventId } = family
      const sub = await subscribeTo(users.bartek)

      await addGiftAs(users.ola, eventId, participants.bartek, 'Scarf')
      await addGiftAs(users.bartek, eventId, participants.bartek, 'Book')
      await waitFor(() => sub.docs('activity').size === 1)

      assert.deepStrictEqual(giftTitles(sub), ['Book'])
      assert.strictEqual(leaksHiddenFrom(sub), false)
    })

    it('publishes nothing to a non-member or a signed-out caller', async function () {
      await seedAboutBartek(family)

      for (const userId of [family.users.outsider, null]) {
        const sub = await subscribeTo(userId)
        assert.strictEqual(sub.docs('activity').size, 0)
      }
    })

    it('stops once the viewer is removed from the event', async function () {
      const { users, participants, eventId } = family
      await addGiftAs(users.bartek, eventId, participants.dziadek, 'Pipe')
      const sub = await subscribeTo(users.celina)
      assert.strictEqual(sub.docs('activity').size, 1)

      await callAsUser(users.ola, 'events.removeParticipant', {
        eventId,
        participantId: participants.celina,
      })
      await waitFor(() => sub.stopped())

      assert.strictEqual(sub.docs('activity').size, 0)
    })
  })

  describe('activity.recentForUser', function () {
    const subscribeAs = (userId: string | null) =>
      subscribe(userId, 'activity.recentForUser')

    // Items at known, distinct times, so "newest" is unambiguous.
    const insertAt = (
      eventId: string,
      minute: number,
      extra: Partial<ActivityDoc> = {},
    ) =>
      Activity.insertAsync({
        eventId,
        kind: 'gift-added',
        actorParticipantId: family.participants.ola,
        createdAt: new Date(Date.UTC(2026, 0, 1, 0, minute)),
        giftTitle: `m${minute}`,
        ...extra,
      } as ActivityDoc)

    const createSecondEvent = async () => {
      const { users } = family
      const { _id } = await callAsUser<{ _id: string }>(
        users.bartek,
        'events.create',
        {
          title: 'Urodziny',
          date: '2026-05-01',
          type: 'many-to-many',
          participants: [{ kind: 'real', userId: users.celina }],
        },
      )
      return _id
    }

    it('publishes the 3 newest items of each of the caller’s events', async function () {
      const second = await createSecondEvent()
      for (const minute of [1, 5, 2, 4, 3]) {
        await insertAt(family.eventId, minute)
      }
      await insertAt(second, 10)
      await insertAt(second, 11)

      const sub = await subscribeAs(family.users.celina)

      assert.deepStrictEqual(giftTitles(sub), ['m10', 'm11', 'm3', 'm4', 'm5'])
    })

    it('applies the same filter before capping, and never publishes hiddenFromParticipantId', async function () {
      const { participants, eventId, users } = family
      await insertAt(eventId, 1)
      await insertAt(eventId, 2)
      await insertAt(eventId, 3, {
        hiddenFromParticipantId: participants.bartek,
      })
      await insertAt(eventId, 4, {
        hiddenFromParticipantId: participants.bartek,
      })
      await insertAt(eventId, 5)

      const bartek = await subscribeAs(users.bartek)
      const celina = await subscribeAs(users.celina)

      assert.deepStrictEqual(giftTitles(bartek), ['m1', 'm2', 'm5'])
      assert.deepStrictEqual(giftTitles(celina), ['m3', 'm4', 'm5'])
      assert.strictEqual(leaksHiddenFrom(bartek), false)
      assert.strictEqual(leaksHiddenFrom(celina), false)
    })

    it('leaves out events the caller is not a member of', async function () {
      await seedAboutBartek(family)

      const sub = await subscribeAs(family.users.outsider)

      assert.strictEqual(sub.docs('activity').size, 0)
    })

    it('publishes nothing signed out', async function () {
      await seedAboutBartek(family)

      const sub = await subscribeAs(null)

      assert.strictEqual(sub.docs('activity').size, 0)
    })

    it('swaps in a newer item, pushing out the oldest', async function () {
      const { eventId, users } = family
      for (const minute of [1, 2, 3]) await insertAt(eventId, minute)
      const sub = await subscribeAs(users.celina)

      await insertAt(eventId, 4)
      await waitFor(() => giftTitles(sub).includes('m4'))

      assert.deepStrictEqual(giftTitles(sub), ['m2', 'm3', 'm4'])
    })

    it('follows the caller into an event they join and out of one they leave', async function () {
      const { eventId, users } = family
      const newcomer = await createUser('Newcomer')
      await insertAt(eventId, 1)
      const sub = await subscribeAs(newcomer)
      assert.strictEqual(sub.docs('activity').size, 0)

      const { code } = (await Invites.findOneAsync({ eventId }))!
      await callAsUser(newcomer, 'events.join', { code })
      // m1 plus the newcomer's own participant-joined.
      await waitFor(() => sub.docs('activity').size === 2)

      const joined = (await Activity.findOneAsync({
        kind: 'participant-joined',
      }))!
      await callAsUser(users.ola, 'events.removeParticipant', {
        eventId,
        participantId: joined.actorParticipantId,
      })
      await waitFor(() => sub.docs('activity').size === 0)
      assert.strictEqual(sub.stopped(), false)
    })
  })
})
