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
