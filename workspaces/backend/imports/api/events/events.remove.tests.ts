import type { EventDoc } from '@prezentowo/types'
import assert from 'assert'

import {
  addGiftAs,
  createEventWithMembers,
  createFamilyEvent,
} from '../../../tests/fixtures'
import {
  callAsUser,
  rejectsWithReason,
  resetDatabase,
} from '../../../tests/helpers'
import { isStored, uploadAs, useImagesSandbox } from '../../../tests/images'
import { Gifts } from '../gifts/gifts.collection'
import { Invites, createInviteIndexes } from '../invites/invites.collection'
import '../invites/invites.methods'
import { Events } from './events.collection'
import './events.methods'

const eventOf = async (eventId: string) =>
  (await Events.findOneAsync(eventId)) as EventDoc

describe('events.removeParticipant', function () {
  useImagesSandbox()

  let family: Awaited<ReturnType<typeof createFamilyEvent>>

  const remove = (
    participantId: string,
    as: string | null = family.users.ola,
  ) =>
    callAsUser(as, 'events.removeParticipant', {
      eventId: family.eventId,
      participantId,
    })

  before(async function () {
    await createInviteIndexes()
  })

  beforeEach(async function () {
    await resetDatabase()
    family = await createFamilyEvent()
  })

  describe('who', function () {
    it('rejects every caller but the creator', async function () {
      const { bartek, outsider } = family.users
      for (const caller of [bartek, outsider]) {
        await rejectsWithReason(
          remove(family.participants.celina, caller),
          'notTheEventCreator',
        )
      }
      const event = await eventOf(family.eventId)
      assert.strictEqual(event.participants.length, 4)
    })

    it('rejects a signed-out caller', async function () {
      await rejectsWithReason(
        remove(family.participants.celina, null),
        'mustBeLoggedIn',
      )
    })

    it('rejects an unknown event', async function () {
      await rejectsWithReason(
        callAsUser(family.users.ola, 'events.removeParticipant', {
          eventId: 'nope',
          participantId: family.participants.celina,
        }),
        'eventNotFound',
      )
    })
  })

  describe('whom', function () {
    it('removes a real participant, who is no longer a member', async function () {
      const { users, participants, eventId } = family

      await remove(participants.celina)

      const event = await eventOf(eventId)
      assert.deepStrictEqual(
        event.participants.map(p => p.id),
        [participants.ola, participants.bartek, participants.dziadek],
      )
      await rejectsWithReason(
        addGiftAs(users.celina, eventId, participants.bartek, 'Scarf'),
        'notAParticipant',
      )
    })

    it('removes a placeholder', async function () {
      await remove(family.participants.dziadek)

      const event = await eventOf(family.eventId)
      assert.ok(!event.participants.some(p => p.kind === 'placeholder'))
    })

    it('rejects a participant the event does not have', async function () {
      await rejectsWithReason(remove('stranger'), 'participantNotFound')
    })

    it('rejects removing the creator', async function () {
      await rejectsWithReason(
        remove(family.participants.ola),
        'cannotRemoveCreator',
      )
    })

    it('rejects removing the current beneficiary', async function () {
      const { participants, eventId, users } = family
      await callAsUser(users.ola, 'events.update', {
        eventId,
        kind: {
          type: 'many-to-one',
          beneficiaryParticipantId: participants.dziadek,
        },
      })

      await rejectsWithReason(
        remove(participants.dziadek),
        'cannotRemoveBeneficiary',
      )

      const event = await eventOf(eventId)
      assert.ok(event.participants.some(p => p.id === participants.dziadek))
      // Anyone else in a many-to-one event can still go.
      await remove(participants.celina)
    })
  })

  describe('presents', function () {
    it('deletes every present for them, whoever added it', async function () {
      const { users, participants, eventId } = family
      const own = await addGiftAs(
        users.celina,
        eventId,
        participants.celina,
        'Book',
      )
      const suggested = await addGiftAs(
        users.bartek,
        eventId,
        participants.celina,
        'Scarf',
      )

      await remove(participants.celina)

      assert.strictEqual(await Gifts.findOneAsync(own), undefined)
      assert.strictEqual(await Gifts.findOneAsync(suggested), undefined)
    })

    it('deletes the uploads of the presents it deletes', async function () {
      const { users, participants, eventId } = family
      const image = await uploadAs(users.bartek)
      await addGiftAs(users.bartek, eventId, participants.dziadek, 'Pipe', {
        image,
      })

      await remove(participants.dziadek)

      assert.strictEqual(await isStored(image.id), false)
    })

    it('keeps the presents they added for others', async function () {
      const { users, participants, eventId } = family
      const image = await uploadAs(users.celina)
      const gift = await addGiftAs(
        users.celina,
        eventId,
        participants.bartek,
        'Socks',
        { image },
      )

      await remove(participants.celina)

      const kept = await Gifts.findOneAsync(gift)
      assert.ok(kept)
      assert.strictEqual(kept.createdBy, users.celina)
      assert.strictEqual(await isStored(image.id), true)
    })

    it('keeps everyone else’s presents', async function () {
      const { users, participants, eventId } = family
      const gift = await addGiftAs(
        users.ola,
        eventId,
        participants.bartek,
        'Tie',
      )

      await remove(participants.celina)

      assert.ok(await Gifts.findOneAsync(gift))
    })

    it('pulls their claims from every present in the event', async function () {
      const { users, participants, eventId } = family
      const tie = await addGiftAs(
        users.ola,
        eventId,
        participants.bartek,
        'Tie',
      )
      const pipe = await addGiftAs(
        users.ola,
        eventId,
        participants.dziadek,
        'Pipe',
      )
      for (const giftId of [tie, pipe]) {
        await callAsUser(users.celina, 'gifts.claim', { giftId })
        await callAsUser(users.ola, 'gifts.claim', { giftId })
      }

      await remove(participants.celina)

      for (const giftId of [tie, pipe]) {
        const gift = await Gifts.findOneAsync(giftId)
        assert.deepStrictEqual(gift?.claimedBy, [users.ola])
      }
    })

    it('leaves their claims in other events alone', async function () {
      const { users, participants } = family
      const otherEventId = await createEventWithMembers(users.bartek, [
        users.celina,
      ])
      const host = (await eventOf(otherEventId)).participants[0]!.id
      const gift = await addGiftAs(users.celina, otherEventId, host, 'Cake')
      await callAsUser(users.celina, 'gifts.claim', { giftId: gift })

      await remove(participants.celina)

      assert.deepStrictEqual((await Gifts.findOneAsync(gift))?.claimedBy, [
        users.celina,
      ])
    })
  })
})

describe('events.delete', function () {
  useImagesSandbox()

  let family: Awaited<ReturnType<typeof createFamilyEvent>>

  const deleteEvent = (
    as: string | null = family.users.ola,
    eventId = family.eventId,
  ) => callAsUser(as, 'events.delete', { eventId })

  before(async function () {
    await createInviteIndexes()
  })

  beforeEach(async function () {
    await resetDatabase()
    family = await createFamilyEvent()
  })

  describe('who', function () {
    it('rejects every caller but the creator', async function () {
      const { bartek, outsider } = family.users
      for (const caller of [bartek, outsider]) {
        await rejectsWithReason(deleteEvent(caller), 'notTheEventCreator')
      }
      assert.ok(await Events.findOneAsync(family.eventId))
    })

    it('rejects a signed-out caller', async function () {
      await rejectsWithReason(deleteEvent(null), 'mustBeLoggedIn')
    })

    it('rejects an unknown event', async function () {
      await rejectsWithReason(
        deleteEvent(family.users.ola, 'nope'),
        'eventNotFound',
      )
    })
  })

  describe('cascade', function () {
    it('deletes the event, its presents and its invite', async function () {
      const { users, participants, eventId } = family
      await addGiftAs(users.bartek, eventId, participants.celina, 'Scarf')
      await addGiftAs(users.celina, eventId, participants.celina, 'Book')
      const { code } = (await Invites.findOneAsync({ eventId }))!

      await deleteEvent()

      assert.strictEqual(await Events.findOneAsync(eventId), undefined)
      assert.strictEqual(await Gifts.find({ eventId }).countAsync(), 0)
      assert.strictEqual(await Invites.find({ eventId }).countAsync(), 0)
      await rejectsWithReason(
        callAsUser(users.outsider, 'invites.ignore', { code }),
        'inviteNotFound',
      )
    })

    it('deletes the background upload and every present upload', async function () {
      const { users, participants, eventId } = family
      const background = await uploadAs(users.ola)
      await callAsUser(users.ola, 'events.update', { eventId, background })
      const photo = await uploadAs(users.bartek)
      await addGiftAs(users.bartek, eventId, participants.celina, 'Scarf', {
        image: photo,
      })

      await deleteEvent()

      assert.strictEqual(await isStored(background.id), false)
      assert.strictEqual(await isStored(photo.id), false)
    })

    it('leaves other events alone', async function () {
      const { users } = family
      const otherEventId = await createEventWithMembers(users.ola, [
        users.bartek,
      ])
      const bartek = (await eventOf(otherEventId)).participants[1]!.id
      const photo = await uploadAs(users.ola)
      const gift = await addGiftAs(users.ola, otherEventId, bartek, 'Cake', {
        image: photo,
      })

      await deleteEvent()

      assert.ok(await Events.findOneAsync(otherEventId))
      assert.ok(await Gifts.findOneAsync(gift))
      assert.ok(await Invites.findOneAsync({ eventId: otherEventId }))
      assert.strictEqual(await isStored(photo.id), true)
    })
  })
})
