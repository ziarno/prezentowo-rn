import type { EventParticipant } from '@prezentowo/types'
import assert from 'assert'

import { createFamilyEvent } from '../../../tests/fixtures'
import {
  callAsUser,
  resetDatabase,
  subscribeAsUser,
  waitFor,
} from '../../../tests/helpers'
import { Events } from './events.collection'
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

  it('takes the event back from a participant once they are removed', async function () {
    const { users, participants, eventId } = family
    const sub = await subscribe(users.bartek)
    assert.ok(sub.docs('events').has(eventId))

    await callAsUser(users.ola, 'events.removeParticipant', {
      eventId,
      participantId: participants.bartek,
    })

    await waitFor(() => sub.stopped())
    assert.strictEqual(sub.docs('events').size, 0)
  })

  it('keeps the event live for the members who stay', async function () {
    const { users, participants, eventId } = family
    const sub = await subscribe(users.celina)

    await callAsUser(users.ola, 'events.removeParticipant', {
      eventId,
      participantId: participants.bartek,
    })
    await callAsUser(users.ola, 'events.update', { eventId, title: 'Święta' })

    await waitFor(() => sub.docs('events').get(eventId)?.title === 'Święta')
    assert.strictEqual(sub.stopped(), false)
  })

  it('ends once the event is deleted', async function () {
    const { users, eventId } = family
    const sub = await subscribe(users.bartek)

    await callAsUser(users.ola, 'events.delete', { eventId })

    await waitFor(() => sub.stopped())
    assert.strictEqual(sub.docs('events').size, 0)
  })

  it('never sends a reserved placeholder’s invitedUserId', async function () {
    const { users, eventId } = family
    await Events.updateAsync(
      { _id: eventId, 'participants.kind': 'placeholder' },
      { $set: { 'participants.$.invitedUserId': users.outsider } },
    )
    const sub = await subscribe(users.bartek)
    const mine = await subscribeAsUser(users.bartek, 'events.mine')
    subs.push(mine)

    await callAsUser(users.ola, 'events.update', { eventId, title: 'Święta' })
    await waitFor(() => sub.docs('events').get(eventId)?.title === 'Święta')
    await waitFor(() => mine.docs('events').get(eventId)?.title === 'Święta')

    for (const { messages } of [sub, mine]) {
      assert.ok(!JSON.stringify(messages).includes('invitedUserId'))
    }
    const placeholder = (
      sub.docs('events').get(eventId)?.participants as EventParticipant[]
    ).find(p => p.kind === 'placeholder')
    assert.deepStrictEqual(placeholder, {
      id: family.participants.dziadek,
      kind: 'placeholder',
      name: 'Dziadek',
      color: '#c33',
    })
  })
})
