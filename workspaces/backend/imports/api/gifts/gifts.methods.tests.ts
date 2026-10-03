import assert from 'assert'

import { addGiftAs, createFamilyEvent } from '../../../tests/fixtures'
import { callAsUser, resetDatabase, whileFailing } from '../../../tests/helpers'
import {
  isAttached,
  isStored,
  uploadAs,
  useImagesSandbox,
} from '../../../tests/images'
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

    it('accepts every present illustration id', async function () {
      const { users, participants, eventId } = family

      for (const id of ['p1', 'p21', 'p40']) {
        const image = { kind: 'illustration', id }
        const gift = await addGiftAs(
          users.celina,
          eventId,
          participants.bartek,
          'Scarf',
          { image },
        )
        assert.deepStrictEqual((await Gifts.findOneAsync(gift))?.image, image)
      }
    })

    it('rejects an illustration id that is not a present', async function () {
      const { users, participants, eventId } = family

      for (const id of ['b3', 'p0', 'p41', 'P3', 'p3 ']) {
        await assert.rejects(
          addGiftAs(users.celina, eventId, participants.bartek, 'Scarf', {
            image: { kind: 'illustration', id },
          }),
          { error: 'invalidArgs', reason: 'unknownIllustration' },
        )
      }
      assert.strictEqual(await Gifts.find({ eventId }).countAsync(), 0)
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

    it('rejects an illustration id that is not a present', async function () {
      const { users, participants, eventId } = family
      const image = { kind: 'illustration', id: 'p3' }
      const gift = await addGiftAs(
        users.celina,
        eventId,
        participants.bartek,
        'Scarf',
        { image },
      )

      await assert.rejects(
        callAsUser(users.celina, 'gifts.update', {
          giftId: gift,
          image: { kind: 'illustration', id: 'b3' },
        }),
        { error: 'invalidArgs', reason: 'unknownIllustration' },
      )
      assert.deepStrictEqual((await Gifts.findOneAsync(gift))?.image, image)
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
  // docs/spec.md §3.1: a gift's upload goes with it, and is replaced or
  // cleared along with its image.
  describe('photos', function () {
    useImagesSandbox()

    const giftWith = (image: unknown) =>
      addGiftAs(
        family.users.celina,
        family.eventId,
        family.participants.bartek,
        'Scarf',
        {
          image,
        },
      )

    it("stores the caller's own upload", async function () {
      const image = await uploadAs(family.users.celina)

      const gift = await giftWith(image)

      assert.deepStrictEqual((await Gifts.findOneAsync(gift))?.image, image)
    })

    it('still answers a replay once its upload has been released', async function () {
      const { users, participants, eventId } = family
      const image = await uploadAs(users.celina)
      const args = { clientId: 'offline-1', image }
      const gift = await addGiftAs(
        users.celina,
        eventId,
        participants.bartek,
        'Scarf',
        args,
      )
      await callAsUser(users.celina, 'gifts.update', {
        giftId: gift,
        image: null,
      })

      const replay = await addGiftAs(
        users.celina,
        eventId,
        participants.bartek,
        'Scarf',
        args,
      )

      assert.strictEqual(replay, gift)
    })

    it("rejects someone else's upload, or one that doesn't exist", async function () {
      const { users, participants, eventId } = family
      const others = await uploadAs(users.bartek)

      for (const image of [others, { kind: 'upload', id: 'x'.repeat(43) }]) {
        await assert.rejects(giftWith(image), {
          error: 'notFound',
          reason: 'imageNotFound',
        })
      }
      assert.strictEqual(await Gifts.find({ eventId }).countAsync(), 0)
      assert.ok(await isStored(others.id))

      const gift = await addGiftAs(
        users.celina,
        eventId,
        participants.bartek,
        'Scarf',
      )
      await assert.rejects(
        callAsUser(users.celina, 'gifts.update', {
          giftId: gift,
          image: others,
        }),
        { error: 'notFound', reason: 'imageNotFound' },
      )
      assert.strictEqual('image' in (await Gifts.findOneAsync(gift))!, false)
    })

    it('attaches the upload on add and on update', async function () {
      const added = await uploadAs(family.users.celina)
      const updated = await uploadAs(family.users.celina)
      const gift = await addGiftAs(
        family.users.celina,
        family.eventId,
        family.participants.bartek,
        'Scarf',
      )
      assert.strictEqual(await isAttached(added.id), false)

      await giftWith(added)
      await callAsUser(family.users.celina, 'gifts.update', {
        giftId: gift,
        image: updated,
      })

      assert.ok(await isAttached(added.id))
      assert.ok(await isAttached(updated.id))
    })

    it("rejects an upload already on a gift, the caller's own included", async function () {
      const { users, eventId } = family
      const image = await uploadAs(users.celina)
      const first = await giftWith(image)
      const second = await addGiftAs(
        users.celina,
        family.eventId,
        family.participants.bartek,
        'Hat',
      )

      await assert.rejects(giftWith(image), {
        error: 'invalidArgs',
        reason: 'imageInUse',
      })
      await assert.rejects(
        callAsUser(users.celina, 'gifts.update', { giftId: second, image }),
        { error: 'invalidArgs', reason: 'imageInUse' },
      )

      assert.strictEqual(await Gifts.find({ eventId }).countAsync(), 2)
      assert.strictEqual('image' in (await Gifts.findOneAsync(second))!, false)
      // Deleting the first gift is still the only thing that deletes it.
      await callAsUser(users.celina, 'gifts.remove', { giftId: first })
      assert.strictEqual(await isStored(image.id), false)
    })

    it('leaves the upload unattached when the write fails', async function () {
      const { users } = family
      const added = await uploadAs(users.celina)
      const updated = await uploadAs(users.celina)
      const gift = await addGiftAs(
        users.celina,
        family.eventId,
        family.participants.bartek,
        'Hat',
      )

      await whileFailing(Gifts, 'insertAsync', () =>
        assert.rejects(giftWith(added)),
      )
      await whileFailing(Gifts, 'updateAsync', () =>
        assert.rejects(
          callAsUser(users.celina, 'gifts.update', {
            giftId: gift,
            image: updated,
          }),
        ),
      )

      assert.strictEqual(await isAttached(added.id), false)
      assert.strictEqual(await isAttached(updated.id), false)
      // So a later save can still take it.
      await giftWith(added)
      assert.ok(await isAttached(added.id))
    })

    it('deletes the replaced upload when the image changes', async function () {
      const first = await uploadAs(family.users.celina)
      const second = await uploadAs(family.users.celina)
      const gift = await giftWith(first)

      await callAsUser(family.users.celina, 'gifts.update', {
        giftId: gift,
        image: second,
      })

      assert.deepStrictEqual((await Gifts.findOneAsync(gift))?.image, second)
      assert.strictEqual(await isStored(first.id), false)
      assert.ok(await isStored(second.id))
    })

    it('deletes the upload when the image is cleared', async function () {
      const image = await uploadAs(family.users.celina)
      const gift = await giftWith(image)

      await callAsUser(family.users.celina, 'gifts.update', {
        giftId: gift,
        image: null,
      })

      assert.strictEqual('image' in (await Gifts.findOneAsync(gift))!, false)
      assert.strictEqual(await isStored(image.id), false)
    })

    it('deletes the upload when it is swapped for an illustration', async function () {
      const image = await uploadAs(family.users.celina)
      const gift = await giftWith(image)

      await callAsUser(family.users.celina, 'gifts.update', {
        giftId: gift,
        image: { kind: 'illustration', id: 'p3' },
      })

      assert.strictEqual(await isStored(image.id), false)
    })

    it('keeps the upload when the image is left out or sent unchanged', async function () {
      const image = await uploadAs(family.users.celina)
      const gift = await giftWith(image)

      await callAsUser(family.users.celina, 'gifts.update', {
        giftId: gift,
        title: 'Hat',
      })
      await callAsUser(family.users.celina, 'gifts.update', {
        giftId: gift,
        image,
      })

      assert.deepStrictEqual((await Gifts.findOneAsync(gift))?.image, image)
      assert.ok(await isStored(image.id))
    })

    it('deletes the upload with the gift, whoever removes it', async function () {
      const { users } = family
      const mine = await uploadAs(users.celina)
      const theirs = await uploadAs(users.celina)
      const byCreator = await giftWith(mine)
      const byEventCreator = await giftWith(theirs)

      await callAsUser(users.celina, 'gifts.remove', { giftId: byCreator })
      await callAsUser(users.ola, 'gifts.remove', { giftId: byEventCreator })

      assert.strictEqual(await isStored(mine.id), false)
      assert.strictEqual(await isStored(theirs.id), false)
    })

    it('keeps the upload when a removal is rejected', async function () {
      const image = await uploadAs(family.users.celina)
      const gift = await addGiftAs(
        family.users.celina,
        family.eventId,
        family.participants.dziadek,
        'Scarf',
        { image },
      )

      await assert.rejects(
        callAsUser(family.users.bartek, 'gifts.remove', { giftId: gift }),
        { error: 'notAuthorized' },
      )

      assert.ok(await isStored(image.id))
    })
  })
})
