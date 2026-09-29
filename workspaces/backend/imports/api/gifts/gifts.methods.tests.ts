import assert from 'assert'

import { addGiftAs, createFamilyEvent } from '../../../tests/fixtures'
import { callAsUser, resetDatabase } from '../../../tests/helpers'
import { Gifts, createGiftIndexes } from './gifts.collection'
import './gifts.methods'

const pickError = (e: Error) => {
  const { error, reason } = e as Error & { error?: unknown; reason?: unknown }
  return { error, reason, message: e.message }
}

describe('gifts methods', function () {
  let family: Awaited<ReturnType<typeof createFamilyEvent>>

  before(async function () {
    await createGiftIndexes()
  })

  beforeEach(async function () {
    await resetDatabase()
    family = await createFamilyEvent()
  })

  describe('gifts.add', function () {
    it('returns the existing gift when its creator replays a clientId', async function () {
      const { users, participants, eventId } = family
      const args = { clientId: 'offline-1' }

      const first = await addGiftAs(
        users.celina,
        eventId,
        participants.bartek,
        'Scarf',
        args,
      )
      const replay = await addGiftAs(
        users.celina,
        eventId,
        participants.bartek,
        'Scarf',
        args,
      )

      assert.strictEqual(replay, first)
      assert.strictEqual(await Gifts.find({ eventId }).countAsync(), 1)
    })

    it('inserts once when the same clientId arrives twice at once', async function () {
      const { users, participants, eventId } = family
      const args = { clientId: 'offline-1' }

      const [a, b] = await Promise.all([
        addGiftAs(users.celina, eventId, participants.bartek, 'Scarf', args),
        addGiftAs(users.celina, eventId, participants.bartek, 'Scarf', args),
      ])

      assert.strictEqual(a, b)
      assert.strictEqual(await Gifts.find({ eventId }).countAsync(), 1)
    })

    it("treats another user's identical clientId as a different gift", async function () {
      const { users, participants, eventId } = family
      const args = { clientId: 'offline-1' }

      const celinaGift = await addGiftAs(
        users.celina,
        eventId,
        participants.bartek,
        'Scarf',
        args,
      )
      const olaGift = await addGiftAs(
        users.ola,
        eventId,
        participants.bartek,
        'Scarf',
        args,
      )

      assert.notStrictEqual(olaGift, celinaGift)
      assert.strictEqual(await Gifts.find({ eventId }).countAsync(), 2)
    })

    it('stores an image reference', async function () {
      const { users, participants, eventId } = family
      const image = { kind: 'illustration', id: 'p3' }

      const gift = await addGiftAs(
        users.celina,
        eventId,
        participants.bartek,
        'Scarf',
        { image },
      )

      assert.deepStrictEqual((await Gifts.findOneAsync(gift))?.image, image)
    })

    it('rejects an image that is not an image reference', async function () {
      const { users, participants, eventId } = family

      for (const image of [
        'p3',
        { kind: 'cdn', id: 'x' },
        { kind: 'upload' },
      ]) {
        await assert.rejects(
          addGiftAs(users.celina, eventId, participants.bartek, 'Scarf', {
            image,
          }),
          /Match error/,
        )
      }
    })

    it('no longer stores a price', async function () {
      const { users, participants, eventId } = family

      const gift = await addGiftAs(
        users.celina,
        eventId,
        participants.bartek,
        'Scarf',
        {
          price: '50 zł',
        },
      )

      assert.strictEqual('price' in (await Gifts.findOneAsync(gift))!, false)
    })

    it('never deduplicates gifts added without a clientId', async function () {
      const { users, participants, eventId } = family

      await addGiftAs(users.celina, eventId, participants.bartek, 'Scarf')
      await addGiftAs(users.celina, eventId, participants.bartek, 'Scarf')

      assert.strictEqual(await Gifts.find({ eventId }).countAsync(), 2)
    })
  })

  describe('gifts.update', function () {
    it('lets the gift creator edit it', async function () {
      const { users, participants, eventId } = family
      const gift = await addGiftAs(
        users.celina,
        eventId,
        participants.bartek,
        'Scarf',
      )

      await callAsUser(users.celina, 'gifts.update', {
        giftId: gift,
        title: 'Wool scarf',
      })

      assert.strictEqual((await Gifts.findOneAsync(gift))?.title, 'Wool scarf')
    })

    it('clears the image on null and keeps it when image is left out', async function () {
      const { users, participants, eventId } = family
      const image = { kind: 'upload', id: 'abc123' }
      const gift = await addGiftAs(
        users.celina,
        eventId,
        participants.bartek,
        'Scarf',
        { image },
      )

      await callAsUser(users.celina, 'gifts.update', {
        giftId: gift,
        title: 'Hat',
      })
      assert.deepStrictEqual((await Gifts.findOneAsync(gift))?.image, image)

      await callAsUser(users.celina, 'gifts.update', {
        giftId: gift,
        image: null,
      })
      assert.strictEqual('image' in (await Gifts.findOneAsync(gift))!, false)
    })

    it('rejects any other member, the event creator included', async function () {
      const { users, participants, eventId } = family
      const gift = await addGiftAs(
        users.celina,
        eventId,
        participants.dziadek,
        'Scarf',
      )

      for (const caller of [users.bartek, users.ola]) {
        await assert.rejects(
          callAsUser(caller, 'gifts.update', { giftId: gift, title: 'Hat' }),
          { error: 'notAuthorized' },
        )
      }
      assert.strictEqual((await Gifts.findOneAsync(gift))?.title, 'Scarf')
    })
  })

  describe('gifts.remove', function () {
    it('lets the gift creator delete it', async function () {
      const { users, participants, eventId } = family
      const gift = await addGiftAs(
        users.celina,
        eventId,
        participants.bartek,
        'Scarf',
      )

      await callAsUser(users.celina, 'gifts.remove', { giftId: gift })

      assert.strictEqual(await Gifts.findOneAsync(gift), undefined)
    })

    it("lets the event creator delete someone else's gift, even with claims", async function () {
      const { users, participants, eventId } = family
      const gift = await addGiftAs(
        users.celina,
        eventId,
        participants.bartek,
        'Scarf',
      )
      await callAsUser(users.ola, 'gifts.claim', { giftId: gift })

      await callAsUser(users.ola, 'gifts.remove', { giftId: gift })

      assert.strictEqual(await Gifts.findOneAsync(gift), undefined)
    })

    it('rejects any other member, the recipient included', async function () {
      const { users, participants, eventId } = family
      const gift = await addGiftAs(
        users.celina,
        eventId,
        participants.dziadek,
        'Scarf',
      )

      await assert.rejects(
        callAsUser(users.bartek, 'gifts.remove', { giftId: gift }),
        { error: 'notAuthorized' },
      )
      assert.ok(await Gifts.findOneAsync(gift))
    })

    it('answers the event creator on a gift hidden from them exactly as on a missing one', async function () {
      const { users, participants, eventId } = family
      const hidden = await addGiftAs(
        users.bartek,
        eventId,
        participants.ola,
        'Teapot',
      )

      const onHidden = await callAsUser(users.ola, 'gifts.remove', {
        giftId: hidden,
      }).catch((e: unknown) => e)
      const onMissing = await callAsUser(users.ola, 'gifts.remove', {
        giftId: 'noSuchGift',
      }).catch((e: unknown) => e)

      assert.ok(onHidden instanceof Error)
      assert.deepStrictEqual(pickError(onHidden), pickError(onMissing as Error))
      assert.strictEqual(pickError(onHidden).error, 'notFound')
      assert.ok(await Gifts.findOneAsync(hidden))
    })
  })

  describe('a gift hidden from the caller', function () {
    it('is not found by update, claim, unclaim or remove, even by its recipient', async function () {
      const { users, participants, eventId } = family
      const hidden = await addGiftAs(
        users.celina,
        eventId,
        participants.bartek,
        'Scarf',
      )
      const calls: [string, object][] = [
        ['gifts.update', { giftId: hidden, title: 'Hat' }],
        ['gifts.claim', { giftId: hidden }],
        ['gifts.unclaim', { giftId: hidden }],
        ['gifts.remove', { giftId: hidden }],
      ]

      for (const [method, args] of calls) {
        await assert.rejects(callAsUser(users.bartek, method, args), {
          error: 'notFound',
          reason: 'giftNotFound',
        })
      }
      assert.strictEqual((await Gifts.findOneAsync(hidden))?.title, 'Scarf')
    })
  })
})
