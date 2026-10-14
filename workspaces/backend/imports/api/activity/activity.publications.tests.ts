import assert from 'assert'

import { addGiftAs, createFamilyEvent } from '../../../tests/fixtures'
import {
  callAsUser,
  resetDatabase,
  subscribeAsUser,
  waitFor,
} from '../../../tests/helpers'
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
})
