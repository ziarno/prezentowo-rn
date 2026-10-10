import assert from 'assert'

import { createUser } from '../../../tests/fixtures'
import { resetDatabase, subscribeAsUser } from '../../../tests/helpers'
import { ownAccount } from './accounts.publications'

describe('the signed-in user’s own document', function () {
  const subs: { stop: () => void }[] = []

  beforeEach(async function () {
    await resetDatabase()
  })

  afterEach(function () {
    subs.splice(0).forEach(sub => sub.stop())
  })

  it('carries createdAt, for Profile’s “Joined”', async function () {
    const userId = await createUser('Ola')
    const sub = await subscribeAsUser(userId, ownAccount)
    subs.push(sub)

    const own = sub.docs('users').get(userId)
    assert.ok(own?.createdAt instanceof Date)
    assert.deepStrictEqual(Object.keys(own), ['createdAt'])
    assert.strictEqual(sub.docs('users').size, 1)
  })

  it('is nothing signed out', async function () {
    await createUser('Ola')
    const sub = await subscribeAsUser(null, ownAccount)
    subs.push(sub)

    assert.deepStrictEqual(sub.messages, [])
  })
})
