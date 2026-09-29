import assert from 'assert'

import { addGiftAs, createFamilyEvent } from '../../../tests/fixtures'
import {
  callAsUser,
  resetDatabase,
  subscribeAsUser,
  waitFor,
} from '../../../tests/helpers'
import { Gifts } from './gifts.collection'
import './gifts.publications'

describe('gifts.byEvent', function () {
  let family: Awaited<ReturnType<typeof createFamilyEvent>>
  const subs: { stop: () => void }[] = []

  const subscribe = async (userId: string) => {
    const sub = await subscribeAsUser(userId, 'gifts.byEvent', family.eventId)
    subs.push(sub)
    return sub
  }

  // Observers deliver in order, so once a gift added after some writes shows
  // up, every one of those writes has been processed.
  const barrier = async (sub: Awaited<ReturnType<typeof subscribe>>) => {
    const { users, participants, eventId } = family
    const id = await addGiftAs(
      users.celina,
      eventId,
      participants.dziadek,
      'Barrier',
    )
    await waitFor(() => sub.docs('gifts').has(id))
  }

  beforeEach(async function () {
    await resetDatabase()
    family = await createFamilyEvent()
  })

  afterEach(function () {
    subs.splice(0).forEach(sub => sub.stop())
  })

  describe('own-list visibility rule', function () {
    it('never sends the recipient a gift someone else suggested for them', async function () {
      const { users, participants, eventId } = family
      const suggested = await addGiftAs(
        users.ola,
        eventId,
        participants.bartek,
        'Scarf',
      )

      const sub = await subscribe(users.bartek)

      assert.strictEqual(sub.docs('gifts').has(suggested), false)
      assert.deepStrictEqual(
        sub.messages.filter(m => m.id === suggested),
        [],
      )
    })

    it('never sends the recipient changes to, or the removal of, a suggested gift', async function () {
      const { users, participants, eventId } = family
      const suggested = await addGiftAs(
        users.ola,
        eventId,
        participants.bartek,
        'Scarf',
      )
      const sub = await subscribe(users.bartek)

      await callAsUser(users.celina, 'gifts.claim', { giftId: suggested })
      await Gifts.updateAsync(suggested, { $set: { title: 'Wool scarf' } })
      await barrier(sub)
      await callAsUser(users.ola, 'gifts.remove', { giftId: suggested })
      await barrier(sub)

      assert.deepStrictEqual(
        sub.messages.filter(m => m.id === suggested),
        [],
      )
    })
  })

  describe('claim-quietly rule', function () {
    it('sends the recipient their self-added gift without its claims', async function () {
      const { users, participants, eventId } = family
      const own = await addGiftAs(
        users.bartek,
        eventId,
        participants.bartek,
        'Book',
      )
      await callAsUser(users.celina, 'gifts.claim', { giftId: own })

      const sub = await subscribe(users.bartek)

      const gift = sub.docs('gifts').get(own)
      assert.strictEqual(gift?.title, 'Book')
      assert.strictEqual('claimedBy' in gift, false)
    })

    it('keeps stripping claims from live updates to a self-added gift', async function () {
      const { users, participants, eventId } = family
      const own = await addGiftAs(
        users.bartek,
        eventId,
        participants.bartek,
        'Book',
      )
      const sub = await subscribe(users.bartek)

      await callAsUser(users.celina, 'gifts.claim', { giftId: own })
      await callAsUser(users.bartek, 'gifts.update', {
        giftId: own,
        title: 'Two books',
      })
      await waitFor(() => sub.docs('gifts').get(own)?.title === 'Two books')

      const leaks = sub.messages.filter(
        m => m.id === own && 'fields' in m && 'claimedBy' in m.fields,
      )
      assert.deepStrictEqual(leaks, [])
    })
  })

  describe('everyone who is not the recipient', function () {
    it('sees self-added and suggested gifts with their claims', async function () {
      const { users, participants, eventId } = family
      const own = await addGiftAs(
        users.bartek,
        eventId,
        participants.bartek,
        'Book',
      )
      const suggested = await addGiftAs(
        users.ola,
        eventId,
        participants.bartek,
        'Scarf',
      )
      await callAsUser(users.ola, 'gifts.claim', { giftId: own })

      const sub = await subscribe(users.celina)

      assert.deepStrictEqual(sub.docs('gifts').get(own)?.claimedBy, [users.ola])
      assert.deepStrictEqual(sub.docs('gifts').get(suggested)?.claimedBy, [])
    })

    it("sees everything on a placeholder's list, since nobody is its recipient", async function () {
      const { users, participants, eventId } = family
      const gift = await addGiftAs(
        users.bartek,
        eventId,
        participants.dziadek,
        'Slippers',
      )
      await callAsUser(users.celina, 'gifts.claim', { giftId: gift })

      for (const viewer of [users.ola, users.bartek, users.celina]) {
        const sub = await subscribe(viewer)
        assert.deepStrictEqual(sub.docs('gifts').get(gift)?.claimedBy, [
          users.celina,
        ])
      }
    })
  })

  describe('the event creator as recipient (no owner exemption)', function () {
    it('never receives a gift suggested for them', async function () {
      const { users, participants, eventId } = family
      const suggested = await addGiftAs(
        users.bartek,
        eventId,
        participants.ola,
        'Teapot',
      )

      const sub = await subscribe(users.ola)

      assert.strictEqual(sub.docs('gifts').has(suggested), false)
    })

    it('receives their self-added gift without its claims', async function () {
      const { users, participants, eventId } = family
      const own = await addGiftAs(
        users.ola,
        eventId,
        participants.ola,
        'Teapot',
      )
      await callAsUser(users.bartek, 'gifts.claim', { giftId: own })

      const sub = await subscribe(users.ola)

      assert.strictEqual('claimedBy' in sub.docs('gifts').get(own)!, false)
    })
  })

  it('never publishes the offline-replay clientId', async function () {
    const { users, participants, eventId } = family
    const gift = await addGiftAs(
      users.bartek,
      eventId,
      participants.bartek,
      'Book',
      {
        clientId: 'offline-1',
      },
    )

    for (const viewer of [users.bartek, users.celina]) {
      const sub = await subscribe(viewer)
      assert.strictEqual('clientId' in sub.docs('gifts').get(gift)!, false)
    }
  })

  it('sends a non-member nothing', async function () {
    const { users, participants, eventId } = family
    await addGiftAs(users.bartek, eventId, participants.bartek, 'Book')

    const sub = await subscribe(users.outsider)

    assert.strictEqual(sub.docs('gifts').size, 0)
  })
})
