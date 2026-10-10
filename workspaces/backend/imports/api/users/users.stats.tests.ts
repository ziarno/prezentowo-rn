import type { UserStats } from '@prezentowo/types'
import assert from 'assert'
import { Random } from 'meteor/random'

import {
  addGiftAs,
  createEventWithMembers,
  createFamilyEvent,
  createUser,
} from '../../../tests/fixtures'
import {
  callAsUser,
  rejectsWithReason,
  resetDatabase,
} from '../../../tests/helpers'
import { Events } from '../events/events.collection'
import { Gifts } from '../gifts/gifts.collection'
import './users.stats'

describe('users.stats', function () {
  let family: Awaited<ReturnType<typeof createFamilyEvent>>

  const statsOf = (userId: string | null) =>
    callAsUser<UserStats>(userId, 'users.stats')

  beforeEach(async function () {
    await resetDatabase()
    family = await createFamilyEvent()
  })

  it('is for signed-in users only', async function () {
    await rejectsWithReason(statsOf(null), 'mustBeLoggedIn')
  })

  it('is zero for someone with no events', async function () {
    assert.deepStrictEqual(await statsOf(family.users.outsider), {
      events: 0,
      wished: 0,
      claimed: 0,
    })
  })

  it('counts events the caller created or joined, past ones included', async function () {
    const past = await callAsUser<{ _id: string }>(
      family.users.bartek,
      'events.create',
      {
        title: 'Dawno temu',
        date: '2001-01-01',
        type: 'many-to-many',
        participants: [],
      },
    )
    assert.ok(past._id)

    assert.strictEqual((await statsOf(family.users.bartek)).events, 2)
    assert.strictEqual((await statsOf(family.users.ola)).events, 1)
  })

  it('does not count an unaccepted reservation', async function () {
    const reserved = Random.id()
    await Events.updateAsync(family.eventId, {
      $push: {
        participants: {
          id: reserved,
          kind: 'placeholder',
          name: 'Kuzyn',
          color: '#333',
          invitedUserId: family.users.outsider,
        },
      },
    })

    assert.strictEqual((await statsOf(family.users.outsider)).events, 0)
  })

  it('counts a gift the caller added for themselves as wished', async function () {
    await addGiftAs(
      family.users.bartek,
      family.eventId,
      family.participants.bartek,
      'Rower',
    )

    assert.strictEqual((await statsOf(family.users.bartek)).wished, 1)
  })

  it('never counts a suggestion for the caller as wished', async function () {
    await addGiftAs(
      family.users.ola,
      family.eventId,
      family.participants.bartek,
      'Niespodzianka',
    )

    assert.strictEqual((await statsOf(family.users.bartek)).wished, 0)
    // …and not as the suggester's wish either: it isn't for them.
    assert.strictEqual((await statsOf(family.users.ola)).wished, 0)
  })

  it('does not count gifts the caller added for someone else as wished', async function () {
    await addGiftAs(
      family.users.bartek,
      family.eventId,
      family.participants.celina,
      'Książka',
    )

    assert.strictEqual((await statsOf(family.users.bartek)).wished, 0)
  })

  it('counts wished gifts whatever their claim state', async function () {
    const giftId = await addGiftAs(
      family.users.bartek,
      family.eventId,
      family.participants.bartek,
      'Rower',
    )
    await callAsUser(family.users.celina, 'gifts.claim', { giftId })

    assert.strictEqual((await statsOf(family.users.bartek)).wished, 1)
  })

  it('counts every claimed gift: for members, placeholders and the caller’s own suggestions', async function () {
    const forCelina = await addGiftAs(
      family.users.ola,
      family.eventId,
      family.participants.celina,
      'Szal',
    )
    const forDziadek = await addGiftAs(
      family.users.ola,
      family.eventId,
      family.participants.dziadek,
      'Kapcie',
    )
    const ownSuggestion = await addGiftAs(
      family.users.bartek,
      family.eventId,
      family.participants.celina,
      'Kubek',
    )
    for (const giftId of [forCelina, forDziadek, ownSuggestion]) {
      await callAsUser(family.users.bartek, 'gifts.claim', { giftId })
    }

    assert.strictEqual((await statsOf(family.users.bartek)).claimed, 3)
  })

  it('counts a shared claim once for each claimer', async function () {
    const giftId = await addGiftAs(
      family.users.ola,
      family.eventId,
      family.participants.dziadek,
      'Kapcie',
    )
    await callAsUser(family.users.bartek, 'gifts.claim', { giftId })
    await callAsUser(family.users.celina, 'gifts.claim', { giftId })

    assert.strictEqual((await statsOf(family.users.bartek)).claimed, 1)
    assert.strictEqual((await statsOf(family.users.celina)).claimed, 1)
  })

  it('counts gifts claimed in other events of the caller only', async function () {
    const other = await createEventWithMembers(family.users.ola, [])
    const giftId = await addGiftAs(
      family.users.ola,
      family.eventId,
      family.participants.dziadek,
      'Kapcie',
    )
    await callAsUser(family.users.bartek, 'gifts.claim', { giftId })
    // A claim left behind in an event the caller isn't in (e.g. removed).
    const stray = await Gifts.insertAsync({
      eventId: other,
      forParticipantId: 'x',
      title: 'Obcy',
      claimedBy: [family.users.bartek],
      createdBy: family.users.ola,
      createdAt: new Date(),
    } as never)
    assert.ok(stray)

    assert.strictEqual((await statsOf(family.users.bartek)).claimed, 1)
  })

  it('drops a removed event’s gifts and the event itself', async function () {
    const wish = await addGiftAs(
      family.users.bartek,
      family.eventId,
      family.participants.bartek,
      'Rower',
    )
    const forDziadek = await addGiftAs(
      family.users.ola,
      family.eventId,
      family.participants.dziadek,
      'Kapcie',
    )
    await callAsUser(family.users.celina, 'gifts.claim', { giftId: wish })
    await callAsUser(family.users.bartek, 'gifts.claim', { giftId: forDziadek })
    assert.deepStrictEqual(await statsOf(family.users.bartek), {
      events: 1,
      wished: 1,
      claimed: 1,
    })

    await callAsUser(family.users.ola, 'events.delete', {
      eventId: family.eventId,
    })

    assert.deepStrictEqual(await statsOf(family.users.bartek), {
      events: 0,
      wished: 0,
      claimed: 0,
    })
    assert.strictEqual((await statsOf(family.users.celina)).claimed, 0)
  })

  it('is not influenced by who else exists', async function () {
    await createUser('Zofia')

    assert.deepStrictEqual(await statsOf(family.users.celina), {
      events: 1,
      wished: 0,
      claimed: 0,
    })
  })
})
