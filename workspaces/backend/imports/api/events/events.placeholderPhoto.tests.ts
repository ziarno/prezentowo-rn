import type { EventDoc, EventParticipant } from '@prezentowo/types'
import assert from 'assert'

import { createFamilyEvent, createUser } from '../../../tests/fixtures'
import {
  callAsUser,
  rejectsWithReason,
  resetDatabase,
  whileFailing,
} from '../../../tests/helpers'
import {
  isAttached,
  isStored,
  uploadAs,
  useImagesSandbox,
} from '../../../tests/images'
import { Invites, createInviteIndexes } from '../invites/invites.collection'
import { loadInvitePreview } from '../invites/invites.preview'
import { Events } from './events.collection'
import './events.methods'

// docs/spec.md §1.11: the creator's photo for a placeholder added by name.

const eventOf = async (eventId: string) =>
  (await Events.findOneAsync(eventId)) as EventDoc

const participantOf = async (eventId: string, participantId: string) =>
  (await eventOf(eventId)).participants.find(p => p.id === participantId) as
    | Extract<EventParticipant, { kind: 'placeholder' }>
    | undefined

describe('placeholder photos', function () {
  useImagesSandbox()

  before(async function () {
    await createInviteIndexes()
  })

  beforeEach(async function () {
    await resetDatabase()
  })

  describe('events.create', function () {
    let ola: string

    beforeEach(async function () {
      ola = await createUser('Ola')
    })

    const create = async (
      participants: Record<string, unknown>[],
      extra: Record<string, unknown> = {},
    ) => {
      const { _id } = await callAsUser<{ _id: string }>(ola, 'events.create', {
        title: 'Urodziny',
        date: '2026-05-04',
        type: 'many-to-many',
        participants,
        ...extra,
      })
      return eventOf(_id)
    }

    const dziadek = (photo: unknown) => ({
      kind: 'placeholder',
      name: 'Dziadek',
      color: '#c33',
      photo,
    })

    it("stores and attaches the caller's own upload as a placeholder's photo", async function () {
      const { id } = await uploadAs(ola)

      const event = await create([dziadek(id)])

      const placeholder = event.participants[1]
      assert.ok(placeholder?.kind === 'placeholder')
      assert.strictEqual(placeholder.photo, id)
      assert.ok(await isAttached(id))
    })

    it("rejects someone else's upload, or one that doesn't exist", async function () {
      const others = await uploadAs(await createUser('Bartek'))

      for (const photo of [others.id, 'x'.repeat(43)]) {
        await rejectsWithReason(create([dziadek(photo)]), 'imageNotFound')
      }
      assert.strictEqual(await Events.find().countAsync(), 0)
    })

    it('rejects one upload on two placeholders, or as the background too, attaching neither', async function () {
      const upload = await uploadAs(ola)
      const other = await uploadAs(ola)

      await rejectsWithReason(
        create([dziadek(other.id), dziadek(upload.id), dziadek(upload.id)]),
        'imageInUse',
      )
      await rejectsWithReason(
        create([dziadek(upload.id)], { background: upload }),
        'imageInUse',
      )

      assert.strictEqual(await Events.find().countAsync(), 0)
      assert.strictEqual(await isAttached(upload.id), false)
      assert.strictEqual(await isAttached(other.id), false)
    })

    it('rejects an empty photo', async function () {
      await assert.rejects(create([dziadek('')]))
    })

    it('leaves every upload unattached when the event is not stored', async function () {
      const background = await uploadAs(ola)
      const photo = await uploadAs(ola)

      await whileFailing(Invites, 'insertAsync', () =>
        assert.rejects(create([dziadek(photo.id)], { background })),
      )

      assert.strictEqual(await isAttached(background.id), false)
      assert.strictEqual(await isAttached(photo.id), false)
    })
  })

  describe('events.updateParticipant', function () {
    let family: Awaited<ReturnType<typeof createFamilyEvent>>
    let ola: string

    beforeEach(async function () {
      family = await createFamilyEvent()
      ola = family.users.ola
    })

    const update = (
      args: Record<string, unknown>,
      userId: string | null = ola,
    ) =>
      callAsUser(userId, 'events.updateParticipant', {
        eventId: family.eventId,
        participantId: family.participants.dziadek,
        ...args,
      })

    const dziadek = () =>
      participantOf(family.eventId, family.participants.dziadek)

    describe('who', function () {
      it('rejects every caller but the creator', async function () {
        const { id } = await uploadAs(family.users.bartek)

        await rejectsWithReason(
          update({ photo: id }, family.users.bartek),
          'notTheEventCreator',
        )
        await rejectsWithReason(
          update({ avatar: 'f2' }, family.users.outsider),
          'notTheEventCreator',
        )
        assert.strictEqual((await dziadek())?.photo, undefined)
        assert.strictEqual((await dziadek())?.avatar, undefined)
      })

      it('rejects a signed-out caller', async function () {
        await rejectsWithReason(
          update({ avatar: 'f2' }, null),
          'mustBeLoggedIn',
        )
      })

      it('rejects an unknown event', async function () {
        await rejectsWithReason(
          update({ eventId: 'nope', avatar: 'f2' }),
          'eventNotFound',
        )
      })
    })

    describe('whom', function () {
      it('rejects a real participant', async function () {
        await rejectsWithReason(
          update({ participantId: family.participants.bartek, avatar: 'f2' }),
          'mustBeAPlaceholder',
        )
      })

      it('rejects a reserved placeholder, whose picture is its invitee’s', async function () {
        const invitee = await createUser('Newcomer')
        const { _id: eventId } = await callAsUser<{ _id: string }>(
          ola,
          'events.create',
          {
            title: 'Imieniny',
            date: '2026-06-01',
            type: 'many-to-many',
            participants: [{ kind: 'invited', userId: invitee, color: '#3c3' }],
          },
        )
        const reserved = (await eventOf(eventId)).participants[1]!

        await rejectsWithReason(
          update({ eventId, participantId: reserved.id, avatar: 'f2' }),
          'placeholderReserved',
        )
      })

      it('rejects a participant the event does not have', async function () {
        await rejectsWithReason(
          update({ participantId: 'nope', avatar: 'f2' }),
          'participantNotFound',
        )
      })
    })

    describe('picture', function () {
      it("stores and attaches the caller's own upload", async function () {
        const { id } = await uploadAs(ola)

        await update({ photo: id })

        assert.strictEqual((await dziadek())?.photo, id)
        assert.ok(await isAttached(id))
      })

      it("rejects someone else's upload, or one that doesn't exist", async function () {
        const others = await uploadAs(family.users.bartek)

        for (const photo of [others.id, 'x'.repeat(43)]) {
          await rejectsWithReason(update({ photo }), 'imageNotFound')
        }
        assert.strictEqual((await dziadek())?.photo, undefined)
      })

      it('rejects an upload already on a document', async function () {
        const { id } = await uploadAs(ola)
        await callAsUser(ola, 'events.update', {
          eventId: family.eventId,
          background: { kind: 'upload', id },
        })

        await rejectsWithReason(update({ photo: id }), 'imageInUse')
      })

      it('deletes the replaced photo', async function () {
        const first = await uploadAs(ola)
        const second = await uploadAs(ola)
        await update({ photo: first.id })

        await update({ photo: second.id })

        assert.strictEqual((await dziadek())?.photo, second.id)
        assert.strictEqual(await isStored(first.id), false)
      })

      it('keeps the photo when it is sent again', async function () {
        const { id } = await uploadAs(ola)
        await update({ photo: id })

        await update({ photo: id })

        assert.strictEqual((await dziadek())?.photo, id)
        assert.ok(await isStored(id))
      })

      it('clears the photo with null, back to a stock avatar, and deletes it', async function () {
        const { id } = await uploadAs(ola)
        await update({ photo: id })

        await update({ avatar: 'm3', photo: null })

        const placeholder = await dziadek()
        assert.strictEqual(placeholder?.photo, undefined)
        assert.strictEqual(placeholder?.avatar, 'm3')
        assert.strictEqual(await isStored(id), false)
      })

      it('leaves the photo alone when only the avatar is sent', async function () {
        const { id } = await uploadAs(ola)
        await update({ photo: id })

        await update({ avatar: 'f2' })

        assert.strictEqual((await dziadek())?.photo, id)
        assert.strictEqual((await dziadek())?.avatar, 'f2')
      })

      it('rejects an empty photo or avatar', async function () {
        await assert.rejects(update({ photo: '' }))
        await assert.rejects(update({ avatar: '' }))
      })

      it('leaves the upload unattached when the write fails', async function () {
        const { id } = await uploadAs(ola)

        await whileFailing(Events, 'updateAsync', () =>
          assert.rejects(update({ photo: id })),
        )

        assert.strictEqual(await isAttached(id), false)
      })
    })
  })

  describe('cleanup', function () {
    let family: Awaited<ReturnType<typeof createFamilyEvent>>
    let photo: string

    beforeEach(async function () {
      family = await createFamilyEvent()
      photo = (await uploadAs(family.users.ola)).id
      await callAsUser(family.users.ola, 'events.updateParticipant', {
        eventId: family.eventId,
        participantId: family.participants.dziadek,
        photo,
      })
    })

    it('deletes the photo when the placeholder is removed', async function () {
      await callAsUser(family.users.ola, 'events.removeParticipant', {
        eventId: family.eventId,
        participantId: family.participants.dziadek,
      })

      assert.strictEqual(await isStored(photo), false)
    })

    it('deletes the photo when the placeholder is claimed, the claimant showing their own picture', async function () {
      const newcomer = await createUser('Newcomer')
      const { code } = (await Invites.findOneAsync({
        eventId: family.eventId,
      }))!

      await callAsUser(newcomer, 'events.join', {
        code,
        participantId: family.participants.dziadek,
      })

      assert.deepStrictEqual(
        await participantOf(family.eventId, family.participants.dziadek),
        { id: family.participants.dziadek, kind: 'real', userId: newcomer },
      )
      assert.strictEqual(await isStored(photo), false)
    })

    it('deletes the photo with the event', async function () {
      await callAsUser(family.users.ola, 'events.delete', {
        eventId: family.eventId,
      })

      assert.strictEqual(await isStored(photo), false)
    })

    it('shows the photo on the invite preview, signed out', async function () {
      const { code } = (await Invites.findOneAsync({
        eventId: family.eventId,
      }))!

      const preview = await loadInvitePreview(code)

      const shown = preview?.unclaimedPlaceholders.find(
        p => p.id === family.participants.dziadek,
      )
      assert.strictEqual(shown?.photo, photo)
    })
  })
})
