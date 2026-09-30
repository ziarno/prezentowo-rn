import type { EventDoc, JoinEventResult } from '@prezentowo/types'
import assert from 'assert'

import {
  addGiftAs,
  createFamilyEvent,
  createUser,
} from '../../../tests/fixtures'
import { callAsUser, resetDatabase } from '../../../tests/helpers'
import { Gifts } from '../gifts/gifts.collection'
import { Invites, createInviteIndexes } from '../invites/invites.collection'
import { Events } from './events.collection'
import './events.methods'

const reasonOf = (e: Error) => (e as Error & { reason?: unknown }).reason

const rejectsWith = (promise: Promise<unknown>, reason: string) =>
  assert.rejects(promise, (e: Error) => {
    assert.strictEqual(reasonOf(e), reason)
    return true
  })

describe('events.join', function () {
  let family: Awaited<ReturnType<typeof createFamilyEvent>>
  let code: string
  let newcomer: string

  const eventOf = async () =>
    (await Events.findOneAsync(family.eventId)) as EventDoc

  const join = (userId: string | null, args: Record<string, unknown>) =>
    callAsUser<JoinEventResult>(userId, 'events.join', args)

  before(async function () {
    await createInviteIndexes()
  })

  beforeEach(async function () {
    await resetDatabase()
    family = await createFamilyEvent()
    code = (await Invites.findOneAsync({ eventId: family.eventId }))!.code
    newcomer = await createUser('Newcomer')
  })

  it('joins the event by its invite code as a new participant', async function () {
    const before = await eventOf()

    const result = await join(newcomer, { code })

    assert.deepStrictEqual(result, { eventId: family.eventId })
    const after = await eventOf()
    assert.strictEqual(
      after.participants.length,
      before.participants.length + 1,
    )
    const joined = after.participants.at(-1)!
    assert.ok(joined.kind === 'real' && joined.userId === newcomer)
    assert.ok(!before.participants.some(p => p.id === joined.id))
  })

  it('claims a placeholder, keeping its id and the gifts on its list', async function () {
    const { users, participants, eventId } = family
    const giftId = await addGiftAs(
      users.ola,
      eventId,
      participants.dziadek,
      'Slippers',
    )
    const before = await eventOf()

    await join(newcomer, { code, participantId: participants.dziadek })

    const after = await eventOf()
    assert.strictEqual(after.participants.length, before.participants.length)
    assert.deepStrictEqual(
      after.participants.find(p => p.id === participants.dziadek),
      { id: participants.dziadek, kind: 'real', userId: newcomer },
    )
    const gift = await Gifts.findOneAsync(giftId)
    assert.strictEqual(gift?.forParticipantId, participants.dziadek)
  })

  it('rejects someone who is already a participant', async function () {
    const { users, participants } = family
    const before = await eventOf()

    await rejectsWith(join(users.bartek, { code }), 'alreadyAParticipant')
    await rejectsWith(join(users.ola, { code }), 'alreadyAParticipant')
    await rejectsWith(
      join(users.bartek, { code, participantId: participants.dziadek }),
      'alreadyAParticipant',
    )

    assert.deepStrictEqual(await eventOf(), before)
  })

  it('rejects a second join by someone who just joined', async function () {
    await join(newcomer, { code })

    await rejectsWith(join(newcomer, { code }), 'alreadyAParticipant')
  })

  it('rejects an unknown code', async function () {
    const unknown = code === 'ZZZZ' ? 'YYYY' : 'ZZZZ'

    await rejectsWith(join(newcomer, { code: unknown }), 'inviteNotFound')
  })

  it('rejects a code once the invite has been rotated away', async function () {
    await Invites.updateAsync({ code }, { $set: { code: 'Rot8' } })

    await rejectsWith(join(newcomer, { code }), 'inviteNotFound')
    await join(newcomer, { code: 'Rot8' })
  })

  it('no longer accepts an eventId as the capability', async function () {
    await assert.rejects(join(newcomer, { eventId: family.eventId }))

    const after = await eventOf()
    assert.ok(
      !after.participants.some(p => p.kind === 'real' && p.userId === newcomer),
    )
  })

  it('rejects claiming someone who is not a placeholder', async function () {
    await rejectsWith(
      join(newcomer, { code, participantId: family.participants.bartek }),
      'mustBeAPlaceholder',
    )
    await rejectsWith(
      join(newcomer, { code, participantId: 'nobody' }),
      'placeholderNotFound',
    )
  })

  it('lets only one of two people claim the same placeholder', async function () {
    const other = await createUser('Other')
    const { dziadek } = family.participants

    const results = await Promise.allSettled([
      join(newcomer, { code, participantId: dziadek }),
      join(other, { code, participantId: dziadek }),
    ])

    assert.deepStrictEqual(results.map(r => r.status).sort(), [
      'fulfilled',
      'rejected',
    ])
    const claimed = (await eventOf()).participants.find(p => p.id === dziadek)
    assert.ok(claimed?.kind === 'real')
  })

  it('requires a signed-in caller', async function () {
    await rejectsWith(join(null, { code }), 'mustBeLoggedIn')
  })
})
