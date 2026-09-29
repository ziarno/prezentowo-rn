import assert from 'assert'

import { resetDatabase } from '../../../tests/helpers'
import {
  INVITE_CODE_ALPHABET,
  insertInvite,
  randomInviteCode,
} from './invites.codes'
import { Invites, createInviteIndexes } from './invites.collection'

// Hands out `codes` in order, one per call.
const sequence = (...codes: string[]) => {
  let i = 0
  return () => codes[i++]!
}

describe('invites', function () {
  before(async function () {
    await createInviteIndexes()
  })

  beforeEach(async function () {
    await resetDatabase()
  })

  it('uses the 57-symbol alphabet without look-alikes', function () {
    assert.strictEqual(new Set(INVITE_CODE_ALPHABET).size, 57)
    for (const lookAlike of '0O1lI') {
      assert.ok(!INVITE_CODE_ALPHABET.includes(lookAlike), lookAlike)
    }
  })

  it('draws 4-char codes from the alphabet', function () {
    for (let i = 0; i < 200; i++) {
      const code = randomInviteCode()
      assert.match(code, /^.{4}$/)
      for (const symbol of code)
        assert.ok(INVITE_CODE_ALPHABET.includes(symbol))
    }
  })

  it('retries with a fresh code when the code is taken', async function () {
    await insertInvite('event-1', 'owner', sequence('AAAA'))

    const code = await insertInvite(
      'event-2',
      'owner',
      sequence('AAAA', 'AAAA', 'BBBB'),
    )

    assert.strictEqual(code, 'BBBB')
    const invite = await Invites.findOneAsync({ eventId: 'event-2' })
    assert.strictEqual(invite?.code, 'BBBB')
  })

  it('gives up after repeated collisions', async function () {
    await insertInvite('event-1', 'owner', sequence('AAAA'))

    await assert.rejects(
      insertInvite('event-2', 'owner', () => 'AAAA'),
      (e: Error) => /inviteCodeExhausted/.test(e.message),
    )
  })

  it('never inserts a second invite for the same event', async function () {
    await insertInvite('event-1', 'owner', sequence('AAAA'))

    await assert.rejects(insertInvite('event-1', 'owner', sequence('BBBB')))
    assert.strictEqual(
      await Invites.find({ eventId: 'event-1' }).countAsync(),
      1,
    )
  })
})
