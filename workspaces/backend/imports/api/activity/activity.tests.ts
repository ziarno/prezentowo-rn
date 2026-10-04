import type { EventDoc } from '@prezentowo/types'
import assert from 'assert'

import {
  addGiftAs,
  createEventWithMembers,
  createFamilyEvent,
  createUser,
} from '../../../tests/fixtures'
import { callAsUser, resetDatabase } from '../../../tests/helpers'
import { useImagesSandbox } from '../../../tests/images'
import { Events } from '../events/events.collection'
import { Invites, createInviteIndexes } from '../invites/invites.collection'
import { Activity } from './activity.collection'
import { recordParticipantJoined } from './activity.records'

const activityOf = (eventId: string) =>
  Activity.find({ eventId }, { sort: { createdAt: 1 } }).fetchAsync()

describe('activity writes', function () {
  let family: Awaited<ReturnType<typeof createFamilyEvent>>

  before(async function () {
    await createInviteIndexes()
  })

  beforeEach(async function () {
    await resetDatabase()
    family = await createFamilyEvent()
  })

  describe('gifts.add', function () {
    it('writes gift-added, visible to all, for a self-added gift', async function () {
      const { users, participants, eventId } = family
      const giftId = await addGiftAs(
        users.bartek,
        eventId,
        participants.bartek,
        'Book',
      )

      const [item, ...rest] = await activityOf(eventId)
      assert.deepStrictEqual(rest, [])
      assert.ok(item?.createdAt instanceof Date)
      assert.deepStrictEqual(
        { ...item, _id: undefined, createdAt: undefined },
        {
          _id: undefined,
          createdAt: undefined,
          eventId,
          kind: 'gift-added',
          actorParticipantId: participants.bartek,
          giftId,
          giftTitle: 'Book',
          recipientParticipantId: participants.bartek,
        },
      )
    })

    it('hides gift-added from the recipient of a suggested gift', async function () {
      const { users, participants, eventId } = family
      await addGiftAs(users.ola, eventId, participants.bartek, 'Scarf')

      const [item] = await activityOf(eventId)
      assert.strictEqual(item?.actorParticipantId, participants.ola)
      assert.strictEqual(item?.hiddenFromParticipantId, participants.bartek)
    })

    it('hides gift-added from a placeholder recipient, for whoever later claims them', async function () {
      const { users, participants, eventId } = family
      await addGiftAs(users.ola, eventId, participants.dziadek, 'Pipe')

      const [item] = await activityOf(eventId)
      assert.strictEqual(item?.hiddenFromParticipantId, participants.dziadek)
    })

    it('writes nothing more for a replayed add', async function () {
      const { users, participants, eventId } = family
      for (let i = 0; i < 2; i++) {
        await addGiftAs(users.bartek, eventId, participants.celina, 'Mug', {
          clientId: 'c1',
        })
      }

      assert.strictEqual((await activityOf(eventId)).length, 1)
    })
  })

  describe('gifts.claim', function () {
    it('writes gift-claimed, always hidden from the recipient', async function () {
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

      await callAsUser(users.celina, 'gifts.claim', { giftId: own })
      await callAsUser(users.celina, 'gifts.claim', { giftId: suggested })

      const claims = (await activityOf(eventId)).filter(
        a => a.kind === 'gift-claimed',
      )
      claims.sort((a, b) => a.giftTitle!.localeCompare(b.giftTitle!))
      assert.deepStrictEqual(
        claims.map(a => ({
          giftId: a.giftId,
          giftTitle: a.giftTitle,
          actor: a.actorParticipantId,
          recipient: a.recipientParticipantId,
          hiddenFrom: a.hiddenFromParticipantId,
        })),
        [
          {
            giftId: own,
            giftTitle: 'Book',
            actor: participants.celina,
            recipient: participants.bartek,
            hiddenFrom: participants.bartek,
          },
          {
            giftId: suggested,
            giftTitle: 'Scarf',
            actor: participants.celina,
            recipient: participants.bartek,
            hiddenFrom: participants.bartek,
          },
        ],
      )
    })

    it('writes nothing for a claim the caller already holds', async function () {
      const { users, participants, eventId } = family
      const giftId = await addGiftAs(
        users.bartek,
        eventId,
        participants.bartek,
        'Book',
      )

      await callAsUser(users.celina, 'gifts.claim', { giftId })
      await callAsUser(users.celina, 'gifts.claim', { giftId })

      const claims = (await activityOf(eventId)).filter(
        a => a.kind === 'gift-claimed',
      )
      assert.strictEqual(claims.length, 1)
    })

    it('writes gift-unclaimed, hidden from the recipient', async function () {
      const { users, participants, eventId } = family
      const giftId = await addGiftAs(
        users.bartek,
        eventId,
        participants.bartek,
        'Book',
      )
      await callAsUser(users.celina, 'gifts.claim', { giftId })

      await callAsUser(users.celina, 'gifts.unclaim', { giftId })

      const item = (await activityOf(eventId)).at(-1)
      assert.deepStrictEqual(
        { ...item, _id: undefined, createdAt: undefined },
        {
          _id: undefined,
          createdAt: undefined,
          eventId,
          kind: 'gift-unclaimed',
          actorParticipantId: participants.celina,
          giftId,
          giftTitle: 'Book',
          recipientParticipantId: participants.bartek,
          hiddenFromParticipantId: participants.bartek,
        },
      )
    })

    it('writes nothing for an unclaim by someone not buying it', async function () {
      const { users, participants, eventId } = family
      const giftId = await addGiftAs(
        users.bartek,
        eventId,
        participants.bartek,
        'Book',
      )

      await callAsUser(users.celina, 'gifts.unclaim', { giftId })

      assert.strictEqual((await activityOf(eventId)).length, 1)
    })
  })

  describe('events.join', function () {
    let code: string
    let newcomer: string

    beforeEach(async function () {
      code = (await Invites.findOneAsync({ eventId: family.eventId }))!.code
      newcomer = await createUser('Newcomer')
    })

    it('writes participant-joined for a new participant', async function () {
      await callAsUser(newcomer, 'events.join', { code })

      const [item, ...rest] = await activityOf(family.eventId)
      assert.deepStrictEqual(rest, [])
      assert.strictEqual(item?.kind, 'participant-joined')
      assert.ok(item?.actorParticipantId)
      assert.ok(
        !Object.values(family.participants).includes(item.actorParticipantId),
      )
      assert.strictEqual(item.hiddenFromParticipantId, undefined)
      assert.strictEqual(item.giftId, undefined)
    })

    it('writes participant-joined with the claimed placeholder as the actor', async function () {
      await callAsUser(newcomer, 'events.join', {
        code,
        participantId: family.participants.dziadek,
      })

      const [item] = await activityOf(family.eventId)
      assert.strictEqual(item?.kind, 'participant-joined')
      assert.strictEqual(item?.actorParticipantId, family.participants.dziadek)
    })
  })

  it('stamps items written in the same millisecond in the order written', async function () {
    const { eventId } = family
    await Promise.all(
      ['a', 'b', 'c'].map(id => recordParticipantJoined(eventId, id)),
    )

    const items = await activityOf(eventId)
    assert.deepStrictEqual(
      items.map(a => a.actorParticipantId),
      ['a', 'b', 'c'],
    )
    assert.strictEqual(new Set(items.map(a => a.createdAt.getTime())).size, 3)
  })
})

describe('activity cascades', function () {
  useImagesSandbox()

  let family: Awaited<ReturnType<typeof createFamilyEvent>>

  before(async function () {
    await createInviteIndexes()
  })

  beforeEach(async function () {
    await resetDatabase()
    family = await createFamilyEvent()
  })

  it('gifts.remove deletes every item for the gift and keeps the rest', async function () {
    const { users, participants, eventId } = family
    const removed = await addGiftAs(
      users.bartek,
      eventId,
      participants.bartek,
      'Book',
    )
    const kept = await addGiftAs(
      users.bartek,
      eventId,
      participants.bartek,
      'Pen',
    )
    await callAsUser(users.celina, 'gifts.claim', { giftId: removed })
    await callAsUser(users.ola, 'gifts.claim', { giftId: removed })

    await callAsUser(users.bartek, 'gifts.remove', { giftId: removed })

    const left = await activityOf(eventId)
    assert.deepStrictEqual(
      left.map(a => a.giftId),
      [kept],
    )
  })

  it('events.delete removes all of its activity and no other event’s', async function () {
    const { users, participants, eventId } = family
    await addGiftAs(users.bartek, eventId, participants.celina, 'Book')
    const otherEventId = await createEventWithMembers(users.bartek, [
      users.celina,
    ])
    const other = (await Events.findOneAsync(otherEventId)) as EventDoc
    await addGiftAs(
      users.bartek,
      otherEventId,
      other.participants[1]!.id,
      'Tea',
    )

    await callAsUser(users.ola, 'events.delete', { eventId })

    assert.deepStrictEqual(await activityOf(eventId), [])
    assert.strictEqual((await activityOf(otherEventId)).length, 1)
  })

  it('events.removeParticipant removes items about them and keeps what they did', async function () {
    const { users, participants, eventId } = family
    const forCelina = await addGiftAs(
      users.ola,
      eventId,
      participants.celina,
      'Scarf',
    )
    await callAsUser(users.bartek, 'gifts.claim', { giftId: forCelina })
    const byCelina = await addGiftAs(
      users.celina,
      eventId,
      participants.bartek,
      'Book',
    )
    await callAsUser(users.celina, 'gifts.claim', { giftId: byCelina })
    const unrelated = await addGiftAs(
      users.ola,
      eventId,
      participants.dziadek,
      'Pipe',
    )

    await callAsUser(users.ola, 'events.removeParticipant', {
      eventId,
      participantId: participants.celina,
    })

    const left = (await activityOf(eventId)).map(a => `${a.kind} ${a.giftId}`)
    assert.deepStrictEqual(
      left.sort(),
      [
        `gift-added ${byCelina}`,
        `gift-added ${unrelated}`,
        `gift-claimed ${byCelina}`,
      ].sort(),
    )
  })
})
