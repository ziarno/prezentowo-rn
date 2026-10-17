import assert from 'assert'
import { Accounts } from 'meteor/accounts-base'
import { Meteor } from 'meteor/meteor'

import { bornAged, createUser } from '../../../tests/fixtures'
import {
  callAsUser,
  createLoginToken,
  rejectsWithReason,
  resetDatabase,
  subscribeAsUser,
} from '../../../tests/helpers'
import { ownAccount } from '../accounts/accounts.publications'
import { Events } from '../events/events.collection'
import '../events/events.methods'
import { pinToday } from '../today'
import './users.birthDate'
import './users.search'

const birthDateOf = async (userId: string) =>
  (await Meteor.users.findOneAsync(userId))?.birthDate

const exists = async (userId: string) =>
  !!(await Meteor.users.findOneAsync(userId, { fields: { _id: 1 } }))

// The user `requestMagicLink` pre-creates and the sign-in then logs in: an
// address, a login token, no name yet.
const justSignedIn = async (address: string) => {
  const userId = await Accounts.createUserAsync({ email: address })
  await createLoginToken(userId)
  return userId
}

const setBirthDate = (userId: string | null, birthDate: unknown) =>
  callAsUser(userId, 'users.setBirthDate', { birthDate })

describe('users.setBirthDate', function () {
  beforeEach(resetDatabase)
  afterEach(() => pinToday(null))

  it('stores the full date, and nothing else about age', async function () {
    const ola = await justSignedIn('ola@example.com')

    await setBirthDate(ola, '2012-03-04')

    assert.strictEqual(await birthDateOf(ola), '2012-03-04')
    const doc = await Meteor.users.findOneAsync(ola)
    assert.deepStrictEqual(
      Object.keys(doc ?? {}).filter(key => /age|birth/i.test(key)),
      ['birthDate'],
    )
  })

  it('says whether it deleted the account', async function () {
    const child = await justSignedIn('child@example.com')
    const ola = await createUser('Ola')
    const bartek = await createUser('Bartek', bornAged(30))

    assert.deepStrictEqual(await setBirthDate(child, bornAged(12)), {
      deleted: true,
    })
    assert.deepStrictEqual(await setBirthDate(ola, bornAged(30)), {
      deleted: false,
    })
    // Already answered: nothing is deleted, whatever is said now.
    assert.deepStrictEqual(await setBirthDate(bartek, bornAged(5)), {
      deleted: false,
    })
    assert.ok(await exists(bartek))
  })

  it('deletes the account of someone under 13, keeping no date', async function () {
    const child = await justSignedIn('child@example.com')

    await setBirthDate(child, bornAged(10))

    assert.strictEqual(await exists(child), false)
    assert.strictEqual(
      await Accounts.findUserByEmail('child@example.com'),
      undefined,
    )
  })

  it('deletes a whole account when an existing user answers under 13', async function () {
    const ola = await createUser('Ola')
    await callAsUser(ola, 'events.create', {
      title: 'Urodziny',
      date: '2026-05-04',
      participants: [],
      type: 'many-to-many',
    })

    await setBirthDate(ola, bornAged(12))

    assert.strictEqual(await exists(ola), false)
    assert.strictEqual(await Events.find({ ownerId: ola }).countAsync(), 0)
  })

  it('lets a person who was deleted start again straight away', async function () {
    const first = await justSignedIn('child@example.com')
    await setBirthDate(first, bornAged(12))

    const again = await justSignedIn('child@example.com')

    assert.deepStrictEqual(await setBirthDate(again, bornAged(30)), {
      deleted: false,
    })
    assert.strictEqual(await birthDateOf(again), bornAged(30))
  })

  it('draws the line at the 13th birthday, by the injected day', async function () {
    const young = await justSignedIn('young@example.com')
    const old = await justSignedIn('old@example.com')

    // Turns 13 tomorrow: 12 years and 364 days old.
    pinToday('2026-10-17')
    assert.deepStrictEqual(await setBirthDate(young, '2013-10-18'), {
      deleted: true,
    })
    assert.deepStrictEqual(await setBirthDate(old, '2013-10-17'), {
      deleted: false,
    })
    assert.strictEqual(await birthDateOf(old), '2013-10-17')
  })

  it('asks once: a stored date is never changed by a later answer', async function () {
    const ola = await createUser('Ola')
    await setBirthDate(ola, '2012-03-04')

    await setBirthDate(ola, '1990-01-01')
    await setBirthDate(ola, bornAged(5))

    assert.strictEqual(await birthDateOf(ola), '2012-03-04')
    assert.ok(await exists(ola))
  })

  it('rejects a date that is malformed, impossible, in the future or over 120 years back', async function () {
    const ola = await createUser('Ola')
    pinToday('2026-10-17')

    for (const birthDate of [
      '',
      'banana',
      '04.03.2012',
      '2012-3-4',
      '2012-03-04T00:00:00Z',
      '2011-02-29',
      '2012-13-01',
      '2012-04-31',
      '2026-10-18',
      '2999-01-01',
      '1906-10-16',
      '0001-01-01',
      20120304,
      null,
      undefined,
    ]) {
      await assert.rejects(
        setBirthDate(ola, birthDate),
        /./,
        `${String(birthDate)} was accepted`,
      )
    }
    assert.strictEqual(await birthDateOf(ola), undefined)
    assert.ok(await exists(ola))
  })

  it('accepts today and the day exactly 120 years back', async function () {
    const ola = await createUser('Ola')
    const bartek = await createUser('Bartek')
    pinToday('2026-10-17')

    assert.deepStrictEqual(await setBirthDate(bartek, '1906-10-17'), {
      deleted: false,
    })
    // Born today: under 13, so the account goes.
    assert.deepStrictEqual(await setBirthDate(ola, '2026-10-17'), {
      deleted: true,
    })
  })

  it('rejects a malformed date even from an account that has one', async function () {
    const ola = await createUser('Ola', bornAged(30))

    await assert.rejects(setBirthDate(ola, 'banana'))
  })

  it('needs a signed-in caller', async function () {
    await rejectsWithReason(setBirthDate(null, bornAged(30)), 'mustBeLoggedIn')
  })
})

describe('the birth date stays on the account', function () {
  const subs: { stop: () => void }[] = []

  beforeEach(resetDatabase)
  afterEach(function () {
    subs.splice(0).forEach(sub => sub.stop())
  })

  it('is published to the user alone, with their own account', async function () {
    const ola = await createUser('Ola', '2012-03-04')
    const marta = await createUser('Marta', '1990-01-01')

    const own = await subscribeAsUser(ola, ownAccount)
    subs.push(own)
    assert.strictEqual(own.docs('users').get(ola)?.birthDate, '2012-03-04')
    assert.strictEqual(own.docs('users').has(marta), false)
  })

  it('is not in users.search results', async function () {
    const ola = await createUser('Ola')
    const marta = await createUser('Marta', bornAged(30))

    const found = await callAsUser<Record<string, unknown>[]>(
      ola,
      'users.search',
      { query: 'marta' },
    )

    assert.strictEqual(found.length, 1)
    assert.strictEqual(found[0]?.userId, marta)
    assert.deepStrictEqual(Object.keys(found[0]!).sort(), ['name', 'userId'])
  })
})
