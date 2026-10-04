import assert from 'assert'
import { Meteor } from 'meteor/meteor'

import { createUser } from '../../../tests/fixtures'
import {
  callAsUser,
  rejectsWithReason,
  resetDatabase,
} from '../../../tests/helpers'
import { isStored, uploadAs, useImagesSandbox } from '../../../tests/images'
import '../events/events.methods'
import './accounts.methods'

describe('updateUser', function () {
  let ola: string

  beforeEach(async function () {
    await resetDatabase()
    ola = await createUser('Ola')
  })

  const profileOf = async (userId: string) =>
    (await Meteor.users.findOneAsync(userId))?.profile

  describe('photo', function () {
    useImagesSandbox()

    it("stores the caller's own upload as their photo", async function () {
      const { id } = await uploadAs(ola)

      await callAsUser(ola, 'updateUser', { photo: id })

      assert.strictEqual((await profileOf(ola))?.photo, id)
    })

    it("rejects someone else's upload, or one that doesn't exist", async function () {
      const others = await uploadAs(await createUser('Bartek'))

      for (const photo of [others.id, 'x'.repeat(43)]) {
        await rejectsWithReason(
          callAsUser(ola, 'updateUser', { photo }),
          'imageNotFound',
        )
      }
      assert.strictEqual((await profileOf(ola))?.photo, undefined)
    })

    it('rejects an upload already on a document', async function () {
      const background = await uploadAs(ola)
      await callAsUser(ola, 'events.create', {
        title: 'Urodziny',
        date: '2026-05-04',
        participants: [],
        type: 'many-to-many',
        background,
      })

      await rejectsWithReason(
        callAsUser(ola, 'updateUser', { photo: background.id }),
        'imageInUse',
      )
    })

    it('takes the current photo again, with the name', async function () {
      const { id } = await uploadAs(ola)
      await callAsUser(ola, 'updateUser', { photo: id })

      await callAsUser(ola, 'updateUser', { name: 'Ola K', photo: id })

      const profile = await profileOf(ola)
      assert.strictEqual(profile?.name, 'Ola K')
      assert.strictEqual(profile?.photo, id)
      assert.ok(await isStored(id))
    })

    it('deletes the replaced photo', async function () {
      const first = await uploadAs(ola)
      const second = await uploadAs(ola)
      await callAsUser(ola, 'updateUser', { photo: first.id })

      await callAsUser(ola, 'updateUser', { photo: second.id })

      assert.strictEqual((await profileOf(ola))?.photo, second.id)
      assert.strictEqual(await isStored(first.id), false)
    })

    it('clears the photo with null, back to the stock avatar, and deletes it', async function () {
      const { id } = await uploadAs(ola)
      await callAsUser(ola, 'updateUser', { avatar: 'f2', photo: id })

      await callAsUser(ola, 'updateUser', { avatar: 'm3', photo: null })

      const profile = await profileOf(ola)
      assert.strictEqual(profile?.photo, undefined)
      assert.strictEqual(profile?.avatar, 'm3')
      assert.strictEqual(await isStored(id), false)
    })

    it('rejects an empty photo, keeping the current one', async function () {
      const { id } = await uploadAs(ola)
      await callAsUser(ola, 'updateUser', { photo: id })

      await assert.rejects(callAsUser(ola, 'updateUser', { photo: '' }))

      assert.strictEqual((await profileOf(ola))?.photo, id)
      assert.ok(await isStored(id))
    })

    it('keeps the photo when the update leaves it out', async function () {
      const { id } = await uploadAs(ola)
      await callAsUser(ola, 'updateUser', { photo: id })

      await callAsUser(ola, 'updateUser', { name: 'Ola K' })

      assert.strictEqual((await profileOf(ola))?.photo, id)
      assert.ok(await isStored(id))
    })
  })
})
