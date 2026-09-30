import assert from 'assert'

import { createFamilyEvent } from '../../../tests/fixtures'
import { resetDatabase, subscribeAsUser } from '../../../tests/helpers'
import './events.publications'

describe('events.byId', function () {
  let family: Awaited<ReturnType<typeof createFamilyEvent>>
  const subs: { stop: () => void }[] = []

  const subscribe = async (userId: string | null) => {
    const sub = await subscribeAsUser(userId, 'events.byId', family.eventId)
    subs.push(sub)
    return sub
  }

  beforeEach(async function () {
    await resetDatabase()
    family = await createFamilyEvent()
  })

  afterEach(function () {
    subs.splice(0).forEach(sub => sub.stop())
  })

  it('sends the event to its members', async function () {
    for (const userId of [family.users.ola, family.users.bartek]) {
      const sub = await subscribe(userId)
      assert.ok(sub.docs('events').has(family.eventId), userId)
    }
  })

  it('is not an invite path: non-members get nothing', async function () {
    for (const userId of [family.users.outsider, null]) {
      const sub = await subscribe(userId)
      assert.deepStrictEqual(sub.messages, [], String(userId))
    }
  })
})
