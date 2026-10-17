import assert from 'assert'
import { Accounts } from 'meteor/accounts-base'
import { Meteor } from 'meteor/meteor'

import { createUser } from '../../../tests/fixtures'
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
import './users.ageBand'
import './users.search'

const bandOf = async (userId: string) =>
  (await Meteor.users.findOneAsync(userId))?.ageBand

const exists = async (userId: string) =>
  !!(await Meteor.users.findOneAsync(userId, { fields: { _id: 1 } }))

// The user `requestMagicLink` pre-creates and the sign-in then logs in: an
// address, a login token, no name yet.
const justSignedIn = async (address: string) => {
  const userId = await Accounts.createUserAsync({ email: address })
  await createLoginToken(userId)
  return userId
}

describe('users.setAgeBand', function () {
  beforeEach(resetDatabase)

  it('stores 13-15 and 16+ as the band, and nothing else about age', async function () {
    const ola = await justSignedIn('ola@example.com')
    const bartek = await justSignedIn('bartek@example.com')

    await callAsUser(ola, 'users.setAgeBand', { answer: '13-15' })
    await callAsUser(bartek, 'users.setAgeBand', { answer: '16+' })

    assert.strictEqual(await bandOf(ola), '13-15')
    assert.strictEqual(await bandOf(bartek), '16+')
    const doc = await Meteor.users.findOneAsync(ola)
    assert.deepStrictEqual(
      Object.keys(doc ?? {}).filter(key => /age|birth/i.test(key)),
      ['ageBand'],
    )
  })

  it('says whether it deleted the account', async function () {
    const child = await justSignedIn('child@example.com')
    const ola = await createUser('Ola')
    const bartek = await createUser('Bartek')
    await callAsUser(bartek, 'users.setAgeBand', { answer: '13-15' })

    assert.deepStrictEqual(
      await callAsUser(child, 'users.setAgeBand', { answer: 'under-13' }),
      { deleted: true },
    )
    assert.deepStrictEqual(
      await callAsUser(ola, 'users.setAgeBand', { answer: '16+' }),
      { deleted: false },
    )
    // Already answered: nothing is deleted, whatever is said now.
    assert.deepStrictEqual(
      await callAsUser(bartek, 'users.setAgeBand', { answer: 'under-13' }),
      { deleted: false },
    )
    assert.ok(await exists(bartek))
  })

  it('deletes the account of someone under 13, keeping no band', async function () {
    const child = await justSignedIn('child@example.com')

    await callAsUser(child, 'users.setAgeBand', { answer: 'under-13' })

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

    await callAsUser(ola, 'users.setAgeBand', { answer: 'under-13' })

    assert.strictEqual(await exists(ola), false)
    assert.strictEqual(await Events.find({ ownerId: ola }).countAsync(), 0)
  })

  it('asks once: a stored band is never changed by a later answer', async function () {
    const ola = await createUser('Ola')
    await callAsUser(ola, 'users.setAgeBand', { answer: '13-15' })

    await callAsUser(ola, 'users.setAgeBand', { answer: '16+' })
    await callAsUser(ola, 'users.setAgeBand', { answer: 'under-13' })

    assert.strictEqual(await bandOf(ola), '13-15')
    assert.ok(await exists(ola))
  })

  it('rejects an answer that is not one of the three', async function () {
    const ola = await createUser('Ola')

    for (const answer of ['', '12', '1990-01-01', 13, null, undefined]) {
      await assert.rejects(callAsUser(ola, 'users.setAgeBand', { answer }))
    }
    assert.strictEqual(await bandOf(ola), undefined)
  })

  it('needs a signed-in caller', async function () {
    await rejectsWithReason(
      callAsUser(null, 'users.setAgeBand', { answer: '16+' }),
      'mustBeLoggedIn',
    )
  })
})

describe('the band stays on the account', function () {
  const subs: { stop: () => void }[] = []

  beforeEach(resetDatabase)
  afterEach(function () {
    subs.splice(0).forEach(sub => sub.stop())
  })

  it('is published to the user alone, with their own account', async function () {
    const ola = await createUser('Ola')
    await callAsUser(ola, 'users.setAgeBand', { answer: '13-15' })

    const sub = await subscribeAsUser(ola, ownAccount)
    subs.push(sub)

    assert.strictEqual(sub.docs('users').get(ola)?.ageBand, '13-15')
  })

  it('is not in users.search results', async function () {
    const ola = await createUser('Ola')
    const marta = await createUser('Marta')
    await callAsUser(marta, 'users.setAgeBand', { answer: '16+' })

    const found = await callAsUser<Record<string, unknown>[]>(
      ola,
      'users.search',
      { query: 'marta' },
    )

    assert.strictEqual(found.length, 1)
    assert.deepStrictEqual(Object.keys(found[0]!).sort(), ['name', 'userId'])
  })
})
