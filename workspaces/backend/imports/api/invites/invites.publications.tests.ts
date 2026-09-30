import type { ImageRef } from '@prezentowo/types'
import assert from 'assert'

import { createFamilyEvent, createUser } from '../../../tests/fixtures'
import {
  callAsUser,
  resetDatabase,
  subscribeAsUser,
  waitFor,
} from '../../../tests/helpers'
import { Events } from '../events/events.collection'
import { Invites, createInviteIndexes } from './invites.collection'
import './invites.publications'

describe('invite publications', function () {
  let family: Awaited<ReturnType<typeof createFamilyEvent>>
  let code: string
  const subs: { stop: () => void }[] = []

  const subscribe = async (
    userId: string | null,
    name: string,
    ...args: unknown[]
  ) => {
    const sub = await subscribeAsUser(userId, name, ...args)
    subs.push(sub)
    return sub
  }

  before(async function () {
    await createInviteIndexes()
  })

  beforeEach(async function () {
    await resetDatabase()
    family = await createFamilyEvent()
    code = (await Invites.findOneAsync({ eventId: family.eventId }))!.code
  })

  afterEach(function () {
    subs.splice(0).forEach(sub => sub.stop())
  })

  describe('invites.byCode', function () {
    it('shows a signed-out viewer the preview and nothing else', async function () {
      const sub = await subscribe(null, 'invites.byCode', code)

      assert.deepStrictEqual(sub.messages, [
        {
          msg: 'added',
          collection: 'invitePreviews',
          id: code,
          fields: {
            code,
            eventId: family.eventId,
            title: 'Wigilia',
            date: '2026-12-24',
            inviterName: 'Ola',
            unclaimedPlaceholders: [
              {
                id: family.participants.dziadek,
                name: 'Dziadek',
                color: '#c33',
              },
            ],
          },
        },
      ])
    })

    it('includes the background when the event has one', async function () {
      const background: ImageRef = { kind: 'illustration', id: 'b3' }
      await Events.updateAsync(family.eventId, { $set: { background } })

      const sub = await subscribe(null, 'invites.byCode', code)

      assert.deepStrictEqual(
        sub.docs('invitePreviews').get(code)?.background,
        background,
      )
    })

    it('publishes nothing for an unknown code', async function () {
      const sub = await subscribe(null, 'invites.byCode', 'ZZZZ')

      assert.deepStrictEqual(sub.messages, [])
    })

    it('drops a placeholder from the list once someone claims it', async function () {
      const sub = await subscribe(null, 'invites.byCode', code)
      const newcomer = await createUser('Newcomer')

      await callAsUser(newcomer, 'events.join', {
        code,
        participantId: family.participants.dziadek,
      })

      await waitFor(
        () =>
          (
            sub.docs('invitePreviews').get(code)
              ?.unclaimedPlaceholders as unknown[]
          )?.length === 0,
      )
    })

    it('follows a change to the event title', async function () {
      const sub = await subscribe(null, 'invites.byCode', code)

      await Events.updateAsync(family.eventId, { $set: { title: 'Święta' } })

      await waitFor(
        () => sub.docs('invitePreviews').get(code)?.title === 'Święta',
      )
    })

    it('removes the preview once the code is rotated away', async function () {
      const sub = await subscribe(null, 'invites.byCode', code)

      await Invites.updateAsync({ code }, { $set: { code: 'Rot8' } })

      await waitFor(() => !sub.docs('invitePreviews').has(code))
    })
  })

  describe('invites.forEvent', function () {
    it("sends the creator the event's invite", async function () {
      const sub = await subscribe(
        family.users.ola,
        'invites.forEvent',
        family.eventId,
      )

      const invites = [...sub.docs('invites').values()]
      assert.strictEqual(invites.length, 1)
      assert.strictEqual(invites[0]!.code, code)
      assert.strictEqual(invites[0]!.eventId, family.eventId)
    })

    it('sends nothing to anyone but the creator', async function () {
      for (const userId of [family.users.bartek, family.users.outsider, null]) {
        const sub = await subscribe(userId, 'invites.forEvent', family.eventId)
        assert.deepStrictEqual(sub.messages, [], String(userId))
      }
    })
  })
})
