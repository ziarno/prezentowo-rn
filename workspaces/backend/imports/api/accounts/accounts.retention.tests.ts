import assert from 'assert'
import { Accounts } from 'meteor/accounts-base'
import { Meteor } from 'meteor/meteor'

import { createUser } from '../../../tests/fixtures'
import { createLoginToken, resetDatabase } from '../../../tests/helpers'
import { sweepNeverSignedInUsers } from './accounts.retention'

const MINUTE_MS = 60_000
const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000)

// A user `requestMagicLink` pre-created for an address: no name, no token.
const preCreated = async (address: string, createdAt: Date) => {
  const userId = await Accounts.createUserAsync({ email: address })
  await Meteor.users.updateAsync(userId, { $set: { createdAt } })
  return userId
}

const exists = async (userId: string) =>
  !!(await Meteor.users.findOneAsync(userId, { fields: { _id: 1 } }))

describe('sweepNeverSignedInUsers', function () {
  beforeEach(resetDatabase)

  it('deletes a user with no name and no login token over 7 days old', async function () {
    const stale = await preCreated('stranger@example.com', daysAgo(8))

    await sweepNeverSignedInUsers()

    assert.strictEqual(await exists(stale), false)
  })

  it('draws the line at 7 days', async function () {
    const justOver = await preCreated(
      'over@example.com',
      new Date(daysAgo(7).getTime() - MINUTE_MS),
    )
    const justUnder = await preCreated(
      'under@example.com',
      new Date(daysAgo(7).getTime() + MINUTE_MS),
    )

    await sweepNeverSignedInUsers()

    assert.strictEqual(await exists(justOver), false)
    assert.ok(await exists(justUnder))
  })

  it('keeps one created less than 7 days ago', async function () {
    const fresh = await preCreated('fresh@example.com', daysAgo(6))

    await sweepNeverSignedInUsers()

    assert.ok(await exists(fresh))
  })

  it('keeps a user with a name, however old', async function () {
    const named = await createUser('Ola')
    await Meteor.users.updateAsync(named, {
      $set: { createdAt: daysAgo(365) },
    })

    await sweepNeverSignedInUsers()

    assert.ok(await exists(named))
  })

  it('keeps a user with a live login token even without a name', async function () {
    const midLogin = await preCreated('mid@example.com', daysAgo(8))
    await createLoginToken(midLogin)

    await sweepNeverSignedInUsers()

    assert.ok(await exists(midLogin))
  })

  it('deletes a user whose login tokens are all gone', async function () {
    const loggedOut = await preCreated('out@example.com', daysAgo(8))
    await createLoginToken(loggedOut)
    await Meteor.users.updateAsync(loggedOut, {
      $set: { 'services.resume.loginTokens': [] },
    })

    await sweepNeverSignedInUsers()

    assert.strictEqual(await exists(loggedOut), false)
  })

  it('treats an empty name as no name', async function () {
    const blank = await preCreated('blank@example.com', daysAgo(8))
    await Meteor.users.updateAsync(blank, { $set: { 'profile.name': '' } })

    await sweepNeverSignedInUsers()

    assert.strictEqual(await exists(blank), false)
  })
})
