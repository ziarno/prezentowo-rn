import type { CreateEventArgs, EventDoc } from '@prezentowo/types'
import assert from 'assert'

import {
  addGiftAs,
  createFamilyEvent,
  createUser,
} from '../../../tests/fixtures'
import { callAsUser, resetDatabase } from '../../../tests/helpers'
import { isStored, uploadAs, useImagesSandbox } from '../../../tests/images'
import { INVITE_CODE_ALPHABET } from '../invites/invites.codes'
import { Invites, createInviteIndexes } from '../invites/invites.collection'
import { Events } from './events.collection'
import './events.methods'

const reasonOf = (e: Error) => (e as Error & { reason?: unknown }).reason

describe('events.create', function () {
  let ola: string
  let bartek: string

  before(async function () {
    await createInviteIndexes()
  })

  beforeEach(async function () {
    await resetDatabase()
    ola = await createUser('Ola')
    bartek = await createUser('Bartek')
  })

  const create = async (args: Record<string, unknown>) => {
    const { _id } = await callAsUser<{ _id: string }>(ola, 'events.create', {
      title: 'Urodziny',
      date: '2026-05-04',
      participants: [],
      type: 'many-to-many',
      ...args,
    })
    return (await Events.findOneAsync(_id)) as EventDoc
  }

  const rejectsWith = (args: Record<string, unknown>, reason: string) =>
    assert.rejects(create(args), (e: Error) => {
      assert.strictEqual(reasonOf(e), reason)
      return true
    })

  describe('kind', function () {
    it('stores a many-to-many event without a beneficiary', async function () {
      const event = await create({ type: 'many-to-many' })

      assert.strictEqual(event.type, 'many-to-many')
      assert.ok(!('beneficiaryParticipantId' in event))
    })

    it('ignores a beneficiaryIndex sent with many-to-many', async function () {
      const event = await create({
        type: 'many-to-many',
        participants: [{ kind: 'real', userId: bartek }],
        beneficiaryIndex: 0,
      })

      assert.ok(!('beneficiaryIndex' in event))
      assert.ok(!('beneficiaryParticipantId' in event))
    })

    it('rejects a missing or unknown type', async function () {
      await rejectsWith({ type: undefined }, 'invalidKind')
      await rejectsWith({ type: 'one-to-one' }, 'invalidKind')
    })

    it('rejects many-to-one without a beneficiary in range', async function () {
      const participants = [{ kind: 'real', userId: bartek }]
      for (const beneficiaryIndex of [undefined, -1, 1, 0.5, '0']) {
        await rejectsWith(
          { type: 'many-to-one', participants, beneficiaryIndex },
          'invalidBeneficiary',
        )
      }
    })

    it('ignores a beneficiaryParticipantId sent by the client', async function () {
      const event = await create({
        type: 'many-to-many',
        beneficiaryParticipantId: 'forged',
      })

      assert.ok(!('beneficiaryParticipantId' in event))
    })
  })

  describe('beneficiary', function () {
    it('resolves the index to the minted id of a placeholder', async function () {
      const event = await create({
        type: 'many-to-one',
        participants: [
          { kind: 'real', userId: bartek },
          { kind: 'placeholder', name: 'Babcia', color: '#c33' },
        ],
        beneficiaryIndex: 1,
      })

      assert.strictEqual(event.type, 'many-to-one')
      const beneficiary = event.participants.find(
        p =>
          event.type === 'many-to-one' &&
          p.id === event.beneficiaryParticipantId,
      )
      assert.ok(beneficiary && beneficiary.kind === 'placeholder')
      assert.strictEqual(beneficiary.name, 'Babcia')
    })

    it('resolves the index to another real participant', async function () {
      const event = await create({
        type: 'many-to-one',
        participants: [{ kind: 'real', userId: bartek }],
        beneficiaryIndex: 0,
      })

      const bartekId = event.participants.find(
        p => p.kind === 'real' && p.userId === bartek,
      )!.id
      assert.ok(event.type === 'many-to-one')
      assert.strictEqual(event.beneficiaryParticipantId, bartekId)
    })

    it("resolves the caller's own entry to the host participant", async function () {
      const event = await create({
        type: 'many-to-one',
        participants: [
          { kind: 'placeholder', name: 'Babcia', color: '#c33' },
          { kind: 'real', userId: ola },
        ],
        beneficiaryIndex: 1,
      })

      const host = event.participants.filter(
        p => p.kind === 'real' && p.userId === ola,
      )
      assert.strictEqual(host.length, 1)
      assert.strictEqual(event.participants[0], host[0])
      assert.ok(event.type === 'many-to-one')
      assert.strictEqual(event.beneficiaryParticipantId, host[0]!.id)
    })
  })

  describe('fields', function () {
    it('rejects a date that is not a calendar day', async function () {
      for (const date of ['next Friday', '2026-02-30', '2026-5-4']) {
        await rejectsWith({ date }, 'invalidDate')
      }
    })

    it('stores a background', async function () {
      const background = { kind: 'illustration', id: 'b3' }
      const event = await create({ background })

      assert.deepStrictEqual(event.background, background)
    })

    it('accepts every stock background id', async function () {
      for (const id of ['b1', 'b20']) {
        const background = { kind: 'illustration', id }
        const event = await create({ background })

        assert.deepStrictEqual(event.background, background)
      }
    })

    it('rejects an illustration id that is not a background', async function () {
      for (const id of ['p3', 'b0', 'b21', 'B3']) {
        await rejectsWith(
          { background: { kind: 'illustration', id } },
          'unknownIllustration',
        )
      }
      assert.strictEqual(await Events.find().countAsync(), 0)
    })
  })

  describe('uploaded background', function () {
    useImagesSandbox()

    it("stores the caller's own upload", async function () {
      const background = await uploadAs(ola)

      const event = await create({ background })

      assert.deepStrictEqual(event.background, background)
    })

    it("rejects someone else's upload, or one that doesn't exist", async function () {
      const others = await uploadAs(bartek)

      for (const background of [
        others,
        { kind: 'upload', id: 'x'.repeat(43) },
      ]) {
        await rejectsWith({ background }, 'imageNotFound')
      }
      assert.strictEqual(await Events.find().countAsync(), 0)
    })
  })

  describe('invite', function () {
    it('inserts one invite for the event with a 4-char code', async function () {
      const event = await create({})

      const invites = await Invites.find({ eventId: event._id }).fetchAsync()
      assert.strictEqual(invites.length, 1)
      const [invite] = invites
      assert.strictEqual(invite!.ownerId, ola)
      assert.strictEqual(invite!.code.length, 4)
      for (const symbol of invite!.code) {
        assert.ok(INVITE_CODE_ALPHABET.includes(symbol), symbol)
      }
    })

    it('mints a different code per event', async function () {
      const codes = new Set<string>()
      for (let i = 0; i < 5; i++) {
        const event = await create({})
        codes.add((await Invites.findOneAsync({ eventId: event._id }))!.code)
      }
      assert.strictEqual(codes.size, 5)
    })
  })

  it('rejects a signed-out caller', async function () {
    const args: CreateEventArgs = {
      title: 'Urodziny',
      date: '2026-05-04',
      participants: [],
      type: 'many-to-many',
    }
    await assert.rejects(callAsUser(null, 'events.create', args), {
      error: 'notAuthorized',
    })
  })
})

describe('events.update', function () {
  let family: Awaited<ReturnType<typeof createFamilyEvent>>

  before(async function () {
    await createInviteIndexes()
  })

  beforeEach(async function () {
    await resetDatabase()
    family = await createFamilyEvent()
  })

  const update = async (
    args: Record<string, unknown>,
    as = family.users.ola,
  ) => {
    await callAsUser(as, 'events.update', { eventId: family.eventId, ...args })
    return (await Events.findOneAsync(family.eventId)) as EventDoc
  }

  const rejectsWith = (
    args: Record<string, unknown>,
    reason: string,
    as = family.users.ola,
  ) =>
    assert.rejects(update(args, as), (e: Error) => {
      assert.strictEqual(reasonOf(e), reason)
      return true
    })

  describe('who', function () {
    it('rejects every caller but the creator', async function () {
      const { bartek, outsider } = family.users
      for (const caller of [bartek, outsider]) {
        await rejectsWith({ title: 'Mine now' }, 'notTheEventCreator', caller)
      }
      const event = (await Events.findOneAsync(family.eventId)) as EventDoc
      assert.strictEqual(event.title, 'Wigilia')
    })

    it('rejects a signed-out caller', async function () {
      await assert.rejects(
        callAsUser(null, 'events.update', { eventId: family.eventId }),
        { error: 'notAuthorized', reason: 'mustBeLoggedIn' },
      )
    })

    it('rejects an unknown event', async function () {
      await assert.rejects(
        callAsUser(family.users.ola, 'events.update', { eventId: 'nope' }),
        { error: 'notFound', reason: 'eventNotFound' },
      )
    })
  })

  describe('fields', function () {
    it('stores a trimmed title and date', async function () {
      const event = await update({
        title: ' Wigilia 2026 ',
        date: '2026-12-25',
      })

      assert.strictEqual(event.title, 'Wigilia 2026')
      assert.strictEqual(event.date, '2026-12-25')
    })

    it('leaves fields it was not sent alone', async function () {
      const before = (await Events.findOneAsync(family.eventId)) as EventDoc

      const event = await update({})

      assert.deepStrictEqual(event, before)
    })

    it('rejects an empty title', async function () {
      await rejectsWith({ title: '  ' }, 'missingFields')
    })

    it('rejects a date that is not a calendar day', async function () {
      for (const date of ['next Friday', '2026-02-30', '2026-5-4', '']) {
        await rejectsWith({ date }, 'invalidDate')
      }
    })
  })

  describe('background', function () {
    it('stores and clears a stock background', async function () {
      const background = { kind: 'illustration', id: 'b3' }

      assert.deepStrictEqual(
        (await update({ background })).background,
        background,
      )
      assert.ok(!('background' in (await update({ background: null }))))
    })

    it('accepts every stock background id', async function () {
      for (const id of ['b1', 'b20']) {
        const background = { kind: 'illustration', id }
        const event = await update({ background })

        assert.deepStrictEqual(event.background, background)
      }
    })

    it('rejects an illustration id that is not a background', async function () {
      for (const id of ['p3', 'b0', 'b21', 'B3']) {
        await rejectsWith(
          { background: { kind: 'illustration', id } },
          'unknownIllustration',
        )
      }
      const event = (await Events.findOneAsync(family.eventId)) as EventDoc
      assert.ok(!('background' in event))
    })
  })

  describe('uploaded background', function () {
    useImagesSandbox()

    it("rejects someone else's upload, or one that doesn't exist", async function () {
      const others = await uploadAs(family.users.bartek)

      for (const background of [
        others,
        { kind: 'upload', id: 'x'.repeat(43) },
      ]) {
        await rejectsWith({ background }, 'imageNotFound')
      }
      assert.strictEqual(await isStored(others.id), true)
    })

    it('deletes the replaced upload when the background changes', async function () {
      const first = await uploadAs(family.users.ola)
      const second = await uploadAs(family.users.ola)
      await update({ background: first })

      const event = await update({ background: second })

      assert.deepStrictEqual(event.background, second)
      assert.strictEqual(await isStored(first.id), false)
      assert.strictEqual(await isStored(second.id), true)
    })

    it('deletes the upload when the background is cleared', async function () {
      const upload = await uploadAs(family.users.ola)
      await update({ background: upload })

      await update({ background: null })

      assert.strictEqual(await isStored(upload.id), false)
    })

    it('keeps the upload when it is sent again', async function () {
      const upload = await uploadAs(family.users.ola)
      await update({ background: upload })

      await update({ background: upload, title: 'Wigilia 2026' })

      assert.strictEqual(await isStored(upload.id), true)
    })
  })

  describe('kind', function () {
    it('switches to many-to-one around an existing participant', async function () {
      const { dziadek } = family.participants

      const event = await update({
        kind: { type: 'many-to-one', beneficiaryParticipantId: dziadek },
      })

      assert.ok(event.type === 'many-to-one')
      assert.strictEqual(event.beneficiaryParticipantId, dziadek)
    })

    it('switches back to many-to-many, dropping the beneficiary', async function () {
      await update({
        kind: {
          type: 'many-to-one',
          beneficiaryParticipantId: family.participants.bartek,
        },
      })

      const event = await update({ kind: { type: 'many-to-many' } })

      assert.strictEqual(event.type, 'many-to-many')
      assert.ok(!('beneficiaryParticipantId' in event))
    })

    it('rejects a beneficiary who is not a participant', async function () {
      for (const beneficiaryParticipantId of [undefined, 'stranger', 3]) {
        await rejectsWith(
          { kind: { type: 'many-to-one', beneficiaryParticipantId } },
          'invalidBeneficiary',
        )
      }
    })

    it('rejects an unknown type', async function () {
      for (const kind of [{ type: 'one-to-one' }, {}, 'many-to-many']) {
        await rejectsWith({ kind }, 'invalidKind')
      }
    })

    it('is locked once the event has a present', async function () {
      const { users, participants, eventId } = family
      await addGiftAs(users.bartek, eventId, participants.celina, 'Scarf')

      await rejectsWith(
        {
          kind: {
            type: 'many-to-one',
            beneficiaryParticipantId: participants.celina,
          },
        },
        'kindLocked',
      )
      const event = (await Events.findOneAsync(eventId)) as EventDoc
      assert.strictEqual(event.type, 'many-to-many')
    })

    it('still edits the other fields once the event has a present', async function () {
      const { users, participants, eventId } = family
      await addGiftAs(users.bartek, eventId, participants.celina, 'Scarf')

      const event = await update({
        title: 'Wigilia 2026',
        date: '2026-12-25',
        background: { kind: 'illustration', id: 'b7' },
      })

      assert.strictEqual(event.title, 'Wigilia 2026')
      assert.deepStrictEqual(event.background, {
        kind: 'illustration',
        id: 'b7',
      })
    })
  })
})
