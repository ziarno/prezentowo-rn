import type { ChatThreadDoc, EventDoc, StreamToken } from '@prezentowo/types'
import assert from 'assert'

import { useFakeChatServer } from '../../../tests/chat'
import { createFamilyEvent, createUser } from '../../../tests/fixtures'
import {
  callAsUser,
  rejectsWithReason,
  resetDatabase,
  subscribeAsUser,
  waitFor,
  whileFailing,
} from '../../../tests/helpers'
import { Events } from '../events/events.collection'
import '../events/events.methods'
import { Invites, createInviteIndexes } from '../invites/invites.collection'
import { ChatThreads } from './chat.collection'
import './chat.methods'
import './chat.publications'
import { CHAT_SERVER_USER_ID, setChatServer } from './chat.server'
import {
  freezeBackoff,
  freezeRetiredThreads,
  freezeRetryDelay,
} from './chat.sync'

const cidOf = (t: ChatThreadDoc) =>
  `${t.streamChannelType}:${t.streamChannelId}`

const sorted = (ids: (string | undefined)[]) => [...(ids as string[])].sort()

describe('chat threads', function () {
  const stream = useFakeChatServer()

  let family: Awaited<ReturnType<typeof createFamilyEvent>>

  const liveThreads = (eventId = family.eventId) =>
    ChatThreads.find({ eventId, retiredAt: { $exists: false } }).fetchAsync()

  const eventThread = async (eventId = family.eventId) => {
    const threads = (await liveThreads(eventId)).filter(t => t.kind === 'event')
    assert.strictEqual(threads.length, 1, 'one live event thread')
    return threads[0]!
  }

  const secretThreadFor = async (
    participantId: string,
    eventId = family.eventId,
  ) =>
    (await liveThreads(eventId)).find(
      t => t.kind === 'secret' && t.recipientParticipantId === participantId,
    )

  const codeOf = async (eventId = family.eventId) =>
    (await Invites.findOneAsync({ eventId }))!.code

  const realUserIds = () => {
    const { ola, bartek, celina } = family.users
    return sorted([ola, bartek, celina])
  }

  // Calls made by `run` alone.
  const callsDuring = async (run: () => Promise<unknown>) => {
    const before = stream.calls.length
    await run()
    return stream.calls.slice(before)
  }

  before(async function () {
    await createInviteIndexes()
  })

  beforeEach(async function () {
    await resetDatabase()
    family = await createFamilyEvent()
  })

  describe('events.create', function () {
    it('creates the event thread with every real participant', async function () {
      const thread = await eventThread()
      assert.strictEqual(thread.streamChannelType, 'event_thread')
      assert.deepStrictEqual(stream.membersOf(thread), realUserIds())
    })

    it('creates a secret thread per real recipient, without that recipient', async function () {
      const { users, participants } = family
      for (const [name, userId] of [
        ['ola', users.ola],
        ['bartek', users.bartek],
        ['celina', users.celina],
      ] as const) {
        const thread = await secretThreadFor(participants[name])
        assert.ok(thread, `${name} has a secret thread`)
        assert.strictEqual(thread.streamChannelType, 'secret_thread')
        assert.deepStrictEqual(
          stream.membersOf(thread),
          realUserIds().filter(id => id !== userId),
        )
      }
    })

    it('gives a placeholder no thread and no Stream user', async function () {
      assert.strictEqual(
        await secretThreadFor(family.participants.dziadek),
        undefined,
      )
      assert.strictEqual((await liveThreads()).length, 4)
      const upserted = stream.calls.flatMap(c =>
        c.op === 'upsertUsers' ? c.userIds : [],
      )
      assert.deepStrictEqual(
        sorted([...new Set(upserted)].filter(id => id !== CHAT_SERVER_USER_ID)),
        realUserIds(),
      )
    })

    it('puts the event id in every channel’s custom data', async function () {
      const created = stream.calls.filter(c => c.op === 'createChannel')
      assert.strictEqual(created.length, (await liveThreads()).length)
      for (const call of created) {
        assert.strictEqual(call.eventId, family.eventId)
      }
    })

    it('mints random channel ids, created by a user who is never a member', async function () {
      const threads = await liveThreads()
      const ids = threads.map(t => t.streamChannelId)
      assert.strictEqual(new Set(ids).size, ids.length)
      const event = (await Events.findOneAsync(family.eventId)) as EventDoc
      for (const id of ids) {
        assert.ok(id.length >= 32, 'unguessable')
        assert.ok(!id.includes(family.eventId))
        for (const p of event.participants) assert.ok(!id.includes(p.id))
      }
      for (const thread of threads) {
        const { createdById } = stream.channels.get(cidOf(thread))!
        assert.ok(
          !event.participants.some(
            p => p.kind === 'real' && p.userId === createdById,
          ),
        )
      }
    })

    it('in many-to-one, creates only the beneficiary’s secret thread', async function () {
      const { ola, bartek } = family.users
      const { _id: eventId } = await callAsUser<{ _id: string }>(
        ola,
        'events.create',
        {
          title: 'Urodziny Bartka',
          date: '2026-11-02',
          type: 'many-to-one',
          beneficiaryIndex: 1,
          participants: [
            { kind: 'real', userId: ola },
            { kind: 'placeholder', name: 'Bartek', color: '#3c3' },
            { kind: 'placeholder', name: 'Dziadek', color: '#c33' },
          ],
        },
      )
      const event = (await Events.findOneAsync(eventId)) as EventDoc
      const beneficiary = event.participants[1]!
      const { code } = (await Invites.findOneAsync({ eventId }))!
      await callAsUser(bartek, 'events.join', {
        code,
        participantId: beneficiary.id,
      })
      const secret = (await liveThreads(eventId)).filter(
        t => t.kind === 'secret',
      )
      assert.strictEqual(secret.length, 1)
      assert.strictEqual(secret[0]!.recipientParticipantId, beneficiary.id)
      assert.deepStrictEqual(stream.membersOf(secret[0]!), [ola])
    })

    it('in many-to-one for a placeholder, creates no secret thread', async function () {
      const ola = family.users.ola
      const { _id: eventId } = await callAsUser<{ _id: string }>(
        ola,
        'events.create',
        {
          title: 'Urodziny Dziadka',
          date: '2026-11-02',
          type: 'many-to-one',
          beneficiaryIndex: 0,
          participants: [
            { kind: 'placeholder', name: 'Dziadek', color: '#c33' },
          ],
        },
      )
      const threads = await liveThreads(eventId)
      assert.deepStrictEqual(
        threads.map(t => t.kind),
        ['event'],
      )
    })
  })

  describe('events.join', function () {
    let newcomer: string

    beforeEach(async function () {
      newcomer = await createUser('Newcomer')
    })

    it('adds a newcomer to the event thread and everyone else’s secret threads, with history', async function () {
      const before = await liveThreads()

      const calls = await callsDuring(async () =>
        callAsUser(newcomer, 'events.join', { code: await codeOf() }),
      )

      for (const thread of before) {
        assert.ok(stream.membersOf(thread).includes(newcomer), cidOf(thread))
      }
      const adds = calls.filter(c => c.op === 'addMembers')
      assert.strictEqual(adds.length, before.length)
      assert.ok(adds.every(c => c.op === 'addMembers' && !c.hideHistory))
    })

    it('creates the newcomer’s own secret thread without them', async function () {
      await callAsUser(newcomer, 'events.join', { code: await codeOf() })

      const event = (await Events.findOneAsync(family.eventId)) as EventDoc
      const joined = event.participants.at(-1)!
      const own = await secretThreadFor(joined.id)
      assert.ok(own)
      assert.deepStrictEqual(stream.membersOf(own), realUserIds())
    })

    it('claiming a placeholder creates their secret thread, never with them in it', async function () {
      const { participants } = family

      await callAsUser(newcomer, 'events.join', {
        code: await codeOf(),
        participantId: participants.dziadek,
      })

      const own = await secretThreadFor(participants.dziadek)
      assert.ok(own)
      assert.deepStrictEqual(stream.membersOf(own), realUserIds())
      const everAdded = stream.calls.some(
        c =>
          (c.op === 'addMembers' &&
            c.cid === cidOf(own) &&
            c.userIds.includes(newcomer)) ||
          (c.op === 'createChannel' &&
            c.cid === cidOf(own) &&
            c.members.includes(newcomer)),
      )
      assert.ok(!everAdded)
      assert.ok(stream.membersOf(await eventThread()).includes(newcomer))
    })
  })

  describe('events.update', function () {
    const setKind = (kind: unknown) =>
      callAsUser(family.users.ola, 'events.update', {
        eventId: family.eventId,
        kind,
      })

    it('a beneficiary change retires the old secret thread and mints a fresh one, editing none', async function () {
      const { participants } = family
      await setKind({
        type: 'many-to-one',
        beneficiaryParticipantId: participants.bartek,
      })
      const bartekThread = (await secretThreadFor(participants.bartek))!
      const bartekMembers = stream.membersOf(bartekThread)
      const celinaBefore = (await ChatThreads.findOneAsync({
        recipientParticipantId: participants.celina,
      }))!

      const calls = await callsDuring(() =>
        setKind({
          type: 'many-to-one',
          beneficiaryParticipantId: participants.celina,
        }),
      )

      const retired = await ChatThreads.findOneAsync(bartekThread._id)
      assert.ok(retired!.retiredAt instanceof Date)
      // Frozen, with its members and history left as they were.
      assert.ok(stream.isFrozen(bartekThread))
      assert.deepStrictEqual(stream.membersOf(bartekThread), bartekMembers)
      const celinaThread = (await secretThreadFor(participants.celina))!
      assert.notStrictEqual(
        celinaThread.streamChannelId,
        celinaBefore.streamChannelId,
      )
      assert.deepStrictEqual(
        stream.membersOf(celinaThread),
        realUserIds().filter(id => id !== family.users.celina),
      )
      assert.ok(!calls.some(c => c.op === 'removeMembers'))
      assert.deepStrictEqual(
        (await liveThreads()).filter(t => t.kind === 'secret').map(t => t._id),
        [celinaThread._id],
      )
    })

    it('switching to many-to-one retires every other recipient’s thread', async function () {
      const { participants } = family
      const bartekThread = (await secretThreadFor(participants.bartek))!

      await setKind({
        type: 'many-to-one',
        beneficiaryParticipantId: participants.bartek,
      })

      const secret = (await liveThreads()).filter(t => t.kind === 'secret')
      assert.deepStrictEqual(
        secret.map(t => t._id),
        [bartekThread._id],
      )
    })

    it('makes no Stream calls when only placeholders are involved', async function () {
      const { participants } = family
      await setKind({
        type: 'many-to-one',
        beneficiaryParticipantId: participants.dziadek,
      })
      const calls = await callsDuring(async () => {
        await setKind({
          type: 'many-to-one',
          beneficiaryParticipantId: participants.dziadek,
        })
        await callAsUser(family.users.ola, 'events.update', {
          eventId: family.eventId,
          title: 'Wigilia 2026',
        })
      })
      assert.deepStrictEqual(calls, [])
    })
  })

  describe('events.removeParticipant', function () {
    const remove = (participantId: string) =>
      callAsUser(family.users.ola, 'events.removeParticipant', {
        eventId: family.eventId,
        participantId,
      })

    it('retires their secret thread and removes them from the others', async function () {
      const { users, participants } = family
      const celinaThread = (await secretThreadFor(participants.celina))!

      const calls = await callsDuring(() => remove(participants.celina))

      assert.ok((await ChatThreads.findOneAsync(celinaThread._id))!.retiredAt)
      assert.ok(stream.isFrozen(celinaThread))
      for (const thread of await liveThreads()) {
        assert.ok(
          !stream.membersOf(thread).includes(users.celina),
          cidOf(thread),
        )
      }
      // Never edits the members of the thread about them.
      assert.ok(
        !calls.some(
          c =>
            (c.op === 'addMembers' || c.op === 'removeMembers') &&
            c.cid === cidOf(celinaThread),
        ),
      )
    })

    it('makes no Stream calls for a placeholder', async function () {
      const calls = await callsDuring(() => remove(family.participants.dziadek))
      assert.deepStrictEqual(calls, [])
    })
  })

  describe('retiring a thread', function () {
    const removeCelina = () =>
      callAsUser(family.users.ola, 'events.removeParticipant', {
        eventId: family.eventId,
        participantId: family.participants.celina,
      })

    const record = async (id: string) => (await ChatThreads.findOneAsync(id))!

    let savedBackoff: typeof freezeBackoff
    beforeEach(function () {
      savedBackoff = { ...freezeBackoff }
      freezeBackoff.firstMs = 10
    })
    afterEach(function () {
      Object.assign(freezeBackoff, savedBackoff)
    })

    it('mutes every member on the retired channel, then replaces it, then freezes it', async function () {
      const { participants } = family
      await callAsUser(family.users.ola, 'events.update', {
        eventId: family.eventId,
        kind: {
          type: 'many-to-one',
          beneficiaryParticipantId: participants.bartek,
        },
      })
      const bartekThread = (await secretThreadFor(participants.bartek))!

      const calls = await callsDuring(() =>
        callAsUser(family.users.ola, 'events.update', {
          eventId: family.eventId,
          kind: {
            type: 'many-to-one',
            beneficiaryParticipantId: participants.celina,
          },
        }),
      )

      const cid = cidOf(bartekThread)
      const mutes = calls.flatMap((c, i) =>
        c.op === 'setPushPreferences' && c.cid === cid ? [i] : [],
      )
      assert.deepStrictEqual(
        sorted(
          calls.flatMap(c =>
            c.op === 'setPushPreferences' && c.cid === cid ? [c.userId] : [],
          ),
        ),
        sorted(bartekThread.memberIds),
      )
      for (const userId of bartekThread.memberIds) {
        assert.strictEqual(stream.chatLevelIn(bartekThread, userId), 'none')
      }
      const replaced = calls.findIndex(c => c.op === 'createChannel')
      const frozen = calls.findIndex(
        c => c.op === 'freezeChannel' && c.cid === cid,
      )
      assert.ok(replaced >= 0 && frozen >= 0)
      assert.ok(Math.max(...mutes) < replaced, 'muted before the replacement')
      assert.ok(replaced < frozen, 'frozen last')
      // The members' own chat switch is left alone.
      assert.ok(!calls.some(c => c.op === 'setPushPreferences' && !c.cid))
    })

    it('records frozenAt once the freeze lands', async function () {
      const celinaThread = (await secretThreadFor(family.participants.celina))!

      await removeCelina()

      assert.ok(stream.isFrozen(celinaThread))
      assert.ok((await record(celinaThread._id)).frozenAt instanceof Date)
    })

    it('retries a failing freeze until it lands, and records frozenAt only then', async function () {
      const celinaThread = (await secretThreadFor(family.participants.celina))!
      const freeze = stream.freezeChannel.bind(stream)
      let attempts = 0
      let reachable = false
      stream.freezeChannel = async (type, id) => {
        attempts++
        if (!reachable) throw new Error('Stream is unreachable')
        await freeze(type, id)
      }

      try {
        await removeCelina()
        await waitFor(() => attempts >= 3)

        assert.ok((await record(celinaThread._id)).retiredAt)
        assert.strictEqual((await record(celinaThread._id)).frozenAt, undefined)
        assert.ok(!stream.isFrozen(celinaThread))

        reachable = true
        await waitFor(
          async () => (await record(celinaThread._id)).frozenAt instanceof Date,
        )
      } finally {
        delete (stream as Partial<typeof stream>).freezeChannel
      }
      assert.ok(stream.isFrozen(celinaThread))
    })

    it('backs off, doubling each time up to a cap', function () {
      Object.assign(freezeBackoff, { firstMs: 1000, maxMs: 8000 })
      assert.deepStrictEqual(
        [0, 1, 2, 3, 4, 30].map(freezeRetryDelay),
        [1000, 2000, 4000, 8000, 8000, 8000],
      )
    })

    it('still retires and freezes the thread when the mute fails', async function () {
      const celinaThread = (await secretThreadFor(family.participants.celina))!

      await whileFailing(stream, 'setPushPreferences', removeCelina)

      assert.ok((await record(celinaThread._id)).retiredAt)
      assert.ok(stream.isFrozen(celinaThread))
      assert.ok((await record(celinaThread._id)).frozenAt instanceof Date)
    })

    it('stops retrying once the event is deleted', async function () {
      const celinaThread = (await secretThreadFor(family.participants.celina))!
      let attempts = 0
      stream.freezeChannel = async () => {
        attempts++
        throw new Error('Stream is unreachable')
      }
      try {
        await removeCelina()
        await callAsUser(family.users.ola, 'events.delete', {
          eventId: family.eventId,
        })
        const after = attempts
        await new Promise(resolve => setTimeout(resolve, 100))
        assert.ok(attempts <= after + 1, 'no retries once the thread is gone')
      } finally {
        delete (stream as Partial<typeof stream>).freezeChannel
      }
      assert.strictEqual(
        await ChatThreads.findOneAsync(celinaThread._id),
        undefined,
      )
    })

    it('at startup, freezes every retired thread without frozenAt, and only those', async function () {
      const { participants } = family
      const celinaThread = (await secretThreadFor(participants.celina))!
      const bartekThread = (await secretThreadFor(participants.bartek))!
      await removeCelina()
      await callAsUser(family.users.ola, 'events.update', {
        eventId: family.eventId,
        kind: {
          type: 'many-to-one',
          beneficiaryParticipantId: participants.ola,
        },
      })
      // As if the server stopped before Celina's freeze landed.
      await ChatThreads.updateAsync(celinaThread._id, {
        $unset: { frozenAt: 1 },
      })
      stream.channels.get(cidOf(celinaThread))!.frozen = false

      const calls = await callsDuring(freezeRetiredThreads)

      assert.deepStrictEqual(calls, [
        { op: 'freezeChannel', cid: cidOf(celinaThread) },
      ])
      assert.ok(stream.isFrozen(celinaThread))
      assert.ok((await record(celinaThread._id)).frozenAt instanceof Date)
      assert.ok((await record(bartekThread._id)).frozenAt instanceof Date)
    })
  })

  describe('events.delete', function () {
    it('removes the threads even while chat is off', async function () {
      setChatServer(null)
      await callAsUser(family.users.ola, 'events.delete', {
        eventId: family.eventId,
      })
      assert.strictEqual(
        await ChatThreads.find({ eventId: family.eventId }).countAsync(),
        0,
      )
    })

    it('hard-deletes every channel of the event, retired ones included, and its threads', async function () {
      const { participants } = family
      await callAsUser(family.users.ola, 'events.removeParticipant', {
        eventId: family.eventId,
        participantId: participants.celina,
      })
      const cids = (
        await ChatThreads.find({ eventId: family.eventId }).fetchAsync()
      ).map(cidOf)

      await callAsUser(family.users.ola, 'events.delete', {
        eventId: family.eventId,
      })

      const deletes = stream.calls.filter(c => c.op === 'deleteChannels')
      assert.deepStrictEqual(
        sorted(deletes.flatMap(c => (c.op === 'deleteChannels' ? c.cids : []))),
        sorted(cids),
      )
      assert.ok(deletes.every(c => c.op === 'deleteChannels' && c.hardDelete))
      assert.strictEqual(stream.channels.size, 0)
      assert.strictEqual(
        await ChatThreads.find({ eventId: family.eventId }).countAsync(),
        0,
      )
    })
  })

  describe('when Stream fails', function () {
    it('a removed participant is taken out of the threads by the next change', async function () {
      const { users, participants } = family

      stream.failing = true
      await callAsUser(users.ola, 'events.removeParticipant', {
        eventId: family.eventId,
        participantId: participants.celina,
      })
      stream.failing = false
      assert.ok(stream.membersOf(await eventThread()).includes(users.celina))

      await callAsUser(users.ola, 'events.removeParticipant', {
        eventId: family.eventId,
        participantId: participants.dziadek,
      })

      for (const thread of await liveThreads()) {
        assert.ok(
          !stream.membersOf(thread).includes(users.celina),
          cidOf(thread),
        )
      }
    })

    it('still retires the thread of a removed recipient', async function () {
      const { users, participants } = family
      const celinaThread = (await secretThreadFor(participants.celina))!
      const sub = await subscribeAsUser(
        users.bartek,
        'chatThreads.byEvent',
        family.eventId,
      )

      stream.failing = true
      await callAsUser(users.ola, 'events.removeParticipant', {
        eventId: family.eventId,
        participantId: participants.celina,
      })
      stream.failing = false

      assert.ok((await ChatThreads.findOneAsync(celinaThread._id))!.retiredAt)
      await waitFor(() => !sub.docs('chatThreads').has(celinaThread._id))
      sub.stop()
    })

    it('events.delete still removes the threads', async function () {
      stream.failing = true
      await callAsUser(family.users.ola, 'events.delete', {
        eventId: family.eventId,
      })
      assert.strictEqual(
        await ChatThreads.find({ eventId: family.eventId }).countAsync(),
        0,
      )
    })

    it('still changes the event, and the next change catches chat up', async function () {
      const newcomer = await createUser('Newcomer')
      const code = await codeOf()

      stream.failing = true
      await callAsUser(newcomer, 'events.join', { code })
      stream.failing = false
      const event = (await Events.findOneAsync(family.eventId)) as EventDoc
      assert.ok(
        event.participants.some(
          p => p.kind === 'real' && p.userId === newcomer,
        ),
      )
      assert.ok(!stream.membersOf(await eventThread()).includes(newcomer))

      await callAsUser(family.users.ola, 'events.removeParticipant', {
        eventId: family.eventId,
        participantId: family.participants.dziadek,
      })

      assert.ok(stream.membersOf(await eventThread()).includes(newcomer))
      const joined = event.participants.at(-1)!
      assert.ok(await secretThreadFor(joined.id))
    })
  })

  describe('stream.token', function () {
    it('mints an hour-long token with iat for the caller, and upserts them', async function () {
      const now = Math.floor(Date.now() / 1000)

      const result = await callAsUser<StreamToken>(
        family.users.bartek,
        'stream.token',
      )

      assert.strictEqual(result.apiKey, stream.apiKey)
      const { userId, exp, iat } = JSON.parse(result.token)
      assert.strictEqual(userId, family.users.bartek)
      assert.ok(Math.abs(iat - now) <= 2)
      assert.strictEqual(exp - iat, 60 * 60)
      assert.deepStrictEqual(stream.users.get(family.users.bartek), {
        name: 'Bartek',
      })
    })

    it('rejects a signed-out caller', async function () {
      await rejectsWithReason(
        callAsUser(null, 'stream.token'),
        'mustBeLoggedIn',
      )
    })

    it('rejects when chat is off', async function () {
      setChatServer(null)
      await rejectsWithReason(
        callAsUser(family.users.bartek, 'stream.token'),
        'chatUnavailable',
      )
    })
  })

  describe('chatThreads.byEvent', function () {
    const subscribe = (userId: string | null) =>
      subscribeAsUser(userId, 'chatThreads.byEvent', family.eventId)

    it('publishes the live threads the viewer belongs to, never their own secret thread', async function () {
      const { users, participants } = family
      const sub = await subscribe(users.bartek)

      const published = [...sub.docs('chatThreads').values()]
      const recipients = published.map(
        t => t.recipientParticipantId as string | undefined,
      )
      assert.deepStrictEqual(
        sorted(recipients.filter(Boolean)),
        sorted([participants.ola, participants.celina]),
      )
      assert.strictEqual(published.length, 3)
      assert.ok(!recipients.includes(participants.bartek))
      assert.ok(published.some(t => t.kind === 'event'))
      assert.ok(published.every(t => !('memberIds' in t)))
      sub.stop()
    })

    it('takes a thread back once it is retired', async function () {
      const { users, participants } = family
      const sub = await subscribe(users.bartek)
      const celinaThread = (await secretThreadFor(participants.celina))!
      assert.ok(sub.docs('chatThreads').has(celinaThread._id))

      await callAsUser(users.ola, 'events.removeParticipant', {
        eventId: family.eventId,
        participantId: participants.celina,
      })

      await waitFor(() => !sub.docs('chatThreads').has(celinaThread._id))
      sub.stop()
    })

    it('publishes nothing to a non-member', async function () {
      const sub = await subscribe(family.users.outsider)
      assert.strictEqual(sub.docs('chatThreads').size, 0)
      sub.stop()
    })
  })
})
