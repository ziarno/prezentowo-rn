import type { EventDoc, EventParticipant } from '@prezentowo/types'
import assert from 'assert'

import { createFamilyEvent, createUser } from '../../../tests/fixtures'
import {
  callAsUser,
  rejectsWithReason,
  resetDatabase,
} from '../../../tests/helpers'
import { isAttached, uploadAs, useImagesSandbox } from '../../../tests/images'
import { createInviteIndexes } from '../invites/invites.collection'
import { Notifications } from '../notifications/notifications.collection'
import { Events } from './events.collection'
import './events.methods'

// `6a`'s add: placeholders by name and users found by search.

type Placeholder = Extract<EventParticipant, { kind: 'placeholder' }>

const eventOf = async (eventId: string) =>
  (await Events.findOneAsync(eventId)) as EventDoc

describe('events.addParticipants', function () {
  useImagesSandbox()

  let family: Awaited<ReturnType<typeof createFamilyEvent>>
  let ola: string

  before(async function () {
    await createInviteIndexes()
  })

  beforeEach(async function () {
    await resetDatabase()
    family = await createFamilyEvent()
    ola = family.users.ola
  })

  const add = (
    participants: Record<string, unknown>[],
    userId: string | null = ola,
    eventId = family.eventId,
  ) => callAsUser(userId, 'events.addParticipants', { eventId, participants })

  const added = async (before: number) =>
    (await eventOf(family.eventId)).participants.slice(before) as Placeholder[]

  it('appends placeholders by name, trimmed and capitalised, after everyone else', async function () {
    const before = (await eventOf(family.eventId)).participants.length

    await add([
      { kind: 'placeholder', name: '  babcia ', color: '#c33', avatar: 'f2' },
      { kind: 'placeholder', name: 'Wujek', color: '#3c3' },
    ])

    const [babcia, wujek] = await added(before)
    assert.strictEqual(babcia?.kind, 'placeholder')
    assert.strictEqual(babcia.name, 'Babcia')
    assert.strictEqual(babcia.avatar, 'f2')
    assert.strictEqual(wujek?.name, 'Wujek')
    assert.notStrictEqual(babcia.id, wujek.id)
  })

  it("attaches the caller's own upload as a new placeholder's photo", async function () {
    const before = (await eventOf(family.eventId)).participants.length
    const { id } = await uploadAs(ola)

    await add([
      { kind: 'placeholder', name: 'Babcia', color: '#c33', photo: id },
    ])

    assert.strictEqual((await added(before))[0]?.photo, id)
    assert.ok(await isAttached(id))
  })

  it('reserves a placeholder for a user found by search, and tells them', async function () {
    const before = (await eventOf(family.eventId)).participants.length
    const newcomer = await createUser('Newcomer')

    await add([{ kind: 'invited', userId: newcomer, color: '#3c3' }])

    const [reserved] = await added(before)
    assert.strictEqual(reserved?.name, 'Newcomer')
    assert.strictEqual(reserved.invitedUserId, newcomer)
    assert.ok(
      await Notifications.findOneAsync({
        userId: newcomer,
        eventId: family.eventId,
        kind: 'invited',
      }),
    )
  })

  it('rejects inviting someone already taking part, or already invited', async function () {
    const newcomer = await createUser('Newcomer')
    await add([{ kind: 'invited', userId: newcomer, color: '#3c3' }])
    const before = await eventOf(family.eventId)

    for (const userId of [family.users.bartek, newcomer]) {
      await rejectsWithReason(
        add([{ kind: 'invited', userId, color: '#3c3' }]),
        'alreadyInEvent',
      )
    }
    assert.deepStrictEqual(
      (await eventOf(family.eventId)).participants,
      before.participants,
    )
  })

  it('rejects a real participant, the caller included', async function () {
    for (const userId of [ola, family.users.outsider]) {
      await rejectsWithReason(
        add([{ kind: 'real', userId }]),
        'cannotAddOthers',
      )
    }
  })

  it('rejects every caller but the creator', async function () {
    await rejectsWithReason(
      add(
        [{ kind: 'placeholder', name: 'Babcia', color: '#c33' }],
        family.users.bartek,
      ),
      'notTheEventCreator',
    )
    await rejectsWithReason(
      add([{ kind: 'placeholder', name: 'Babcia', color: '#c33' }], null),
      'mustBeLoggedIn',
    )
  })

  it('leaves the upload unattached when nothing is added', async function () {
    const { id } = await uploadAs(ola)
    const newcomer = await createUser('Newcomer')
    await add([{ kind: 'invited', userId: newcomer, color: '#3c3' }])

    await rejectsWithReason(
      add([
        { kind: 'placeholder', name: 'Babcia', color: '#c33', photo: id },
        { kind: 'invited', userId: newcomer, color: '#3c3' },
      ]),
      'alreadyInEvent',
    )
    assert.strictEqual(await isAttached(id), false)
  })
})
