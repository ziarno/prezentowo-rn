import assert from 'assert'
import { MongoInternals } from 'meteor/mongo'

import { createFamilyEvent } from '../../../tests/fixtures'
import { callAsUser, resetDatabase } from '../../../tests/helpers'
import { Invites, createInviteIndexes } from './invites.collection'
import './invites.methods'

const reasonOf = (e: Error) => (e as Error & { reason?: unknown }).reason

// Every document in the app database, by collection.
const snapshot = async () => {
  const { db } = MongoInternals.defaultRemoteCollectionDriver().mongo
  const collections = await db.collections()
  const out: Record<string, unknown[]> = {}
  for (const c of collections) {
    if (c.collectionName.startsWith('system.')) continue
    out[c.collectionName] = await c.find({}).toArray()
  }
  return out
}

describe('invites.ignore', function () {
  let family: Awaited<ReturnType<typeof createFamilyEvent>>
  let code: string

  before(async function () {
    await createInviteIndexes()
  })

  beforeEach(async function () {
    await resetDatabase()
    family = await createFamilyEvent()
    code = (await Invites.findOneAsync({ eventId: family.eventId }))!.code
  })

  it('accepts a valid code and writes nothing yet', async function () {
    const before = await snapshot()

    await callAsUser(family.users.outsider, 'invites.ignore', { code })

    assert.deepStrictEqual(await snapshot(), before)
  })

  it('rejects an unknown code', async function () {
    await assert.rejects(
      callAsUser(family.users.outsider, 'invites.ignore', { code: 'ZZZZ' }),
      (e: Error) => reasonOf(e) === 'inviteNotFound',
    )
  })

  it('requires a signed-in caller', async function () {
    await assert.rejects(
      callAsUser(null, 'invites.ignore', { code }),
      (e: Error) => reasonOf(e) === 'mustBeLoggedIn',
    )
  })
})

describe('invites.rotate', function () {
  let family: Awaited<ReturnType<typeof createFamilyEvent>>
  let code: string

  before(async function () {
    await createInviteIndexes()
  })

  beforeEach(async function () {
    await resetDatabase()
    family = await createFamilyEvent()
    code = (await Invites.findOneAsync({ eventId: family.eventId }))!.code
  })

  const rotate = (as: string | null = family.users.ola) =>
    callAsUser(as, 'invites.rotate', { eventId: family.eventId })

  it('replaces the code in place', async function () {
    const before = (await Invites.findOneAsync({ eventId: family.eventId }))!

    await rotate()

    const invites = await Invites.find({ eventId: family.eventId }).fetchAsync()
    assert.strictEqual(invites.length, 1)
    const [after] = invites
    assert.strictEqual(after!._id, before._id)
    assert.notStrictEqual(after!.code, code)
    assert.strictEqual(after!.code.length, 4)
    assert.strictEqual(after!.ownerId, before.ownerId)
  })

  it('kills the old code immediately', async function () {
    await rotate()

    await assert.rejects(
      callAsUser(family.users.outsider, 'invites.ignore', { code }),
      (e: Error) => reasonOf(e) === 'inviteNotFound',
    )
    await assert.rejects(
      callAsUser(family.users.outsider, 'events.join', { code }),
      (e: Error) => reasonOf(e) === 'inviteNotFound',
    )
  })

  it('opens the event with the new code', async function () {
    await rotate()
    const fresh = (await Invites.findOneAsync({ eventId: family.eventId }))!

    const { eventId } = await callAsUser<{ eventId: string }>(
      family.users.outsider,
      'events.join',
      { code: fresh.code },
    )

    assert.strictEqual(eventId, family.eventId)
  })

  it('rejects every caller but the creator', async function () {
    for (const caller of [family.users.bartek, family.users.outsider]) {
      await assert.rejects(
        rotate(caller),
        (e: Error) => reasonOf(e) === 'notTheEventCreator',
      )
    }
    const invite = (await Invites.findOneAsync({ eventId: family.eventId }))!
    assert.strictEqual(invite.code, code)
  })

  it('rejects an unknown event', async function () {
    await assert.rejects(
      callAsUser(family.users.ola, 'invites.rotate', { eventId: 'nope' }),
      { error: 'notFound', reason: 'eventNotFound' },
    )
  })

  it('requires a signed-in caller', async function () {
    await assert.rejects(
      rotate(null),
      (e: Error) => reasonOf(e) === 'mustBeLoggedIn',
    )
  })
})
