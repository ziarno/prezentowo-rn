import type { EventDoc } from '@prezentowo/types'
import { Meteor } from 'meteor/meteor'
import { Random } from 'meteor/random'

import { Events } from '../events/events.collection'
import { type ChatThreadRecord, ChatThreads } from './chat.collection'
import { CHAT_SERVER_USER_ID, type ChatServer, chatServer } from './chat.server'
import { streamUsers } from './chat.users'

type WantedThread = Pick<
  ChatThreadRecord,
  'kind' | 'recipientParticipantId' | 'streamChannelType'
> & { memberIds: string[] }

const cidOf = (thread: ChatThreadRecord) =>
  `${thread.streamChannelType}:${thread.streamChannelId}`

/**
 * The threads `event` should have live (docs/spec.md §2.4): one event thread
 * with every real participant, and a secret thread per real recipient with
 * everyone real but them. A placeholder has no userId, so it's in no thread
 * and gets none.
 */
function wantedThreads(event: EventDoc): WantedThread[] {
  const real = event.participants.flatMap(p =>
    p.kind === 'real' ? [{ id: p.id, userId: p.userId }] : [],
  )
  const recipientIds =
    event.type === 'many-to-many'
      ? event.participants.map(p => p.id)
      : [event.beneficiaryParticipantId]
  return [
    {
      kind: 'event',
      streamChannelType: 'event_thread',
      memberIds: real.map(p => p.userId),
    },
    ...real
      .filter(p => recipientIds.includes(p.id))
      .map(
        (recipient): WantedThread => ({
          kind: 'secret',
          recipientParticipantId: recipient.id,
          streamChannelType: 'secret_thread',
          memberIds: real.filter(p => p.id !== recipient.id).map(p => p.userId),
        }),
      ),
  ]
}

const recipientUserId = (event: EventDoc, thread: ChatThreadRecord) => {
  const recipient = event.participants.find(
    p => p.id === thread.recipientParticipantId,
  )
  return recipient?.kind === 'real' ? recipient.userId : undefined
}

// Upserts the channel members `userIds`, and the channel creator.
async function upsertMembersAndCreator(server: ChatServer, userIds: string[]) {
  await server.upsertUsers([
    { id: CHAT_SERVER_USER_ID, name: 'Prezentowo' },
    ...(await streamUsers(userIds)),
  ])
}

const errorName = (error: unknown) =>
  error instanceof Error ? error.name : typeof error

// Mutes everyone on a thread about to be retired, as they all lose it. A
// retired channel keeps its members, so until the freeze lands Stream would
// still push its messages to them. Never throws: the freeze, retried until it
// lands, is what makes the thread push-safe for good.
async function muteMembers(server: ChatServer, thread: ChatThreadRecord) {
  if (thread.memberIds.length === 0) return
  try {
    await server.setPushPreferences(
      thread.memberIds.map(userId => ({
        user_id: userId,
        channel_cid: cidOf(thread),
        chat_level: 'none',
      })),
    )
  } catch (error) {
    console.error('chat', 'mute failed', thread._id, errorName(error))
  }
}

/** The freeze retry's delays: doubling from `firstMs`, up to `maxMs`. */
export const freezeBackoff = { firstMs: 1000, maxMs: 10 * 60 * 1000 }

/** How long the freeze waits after its `attempt`th failure (from 0). */
export const freezeRetryDelay = (attempt: number) =>
  Math.min(freezeBackoff.firstMs * 2 ** attempt, freezeBackoff.maxMs)

// Retired threads with a freeze attempt pending, so each has one retry loop.
const freezing = new Set<string>()

async function freezeAttempt(threadId: string, attempt: number) {
  try {
    const server = chatServer()
    const thread = await ChatThreads.findOneAsync(threadId)
    // Deleted with its event, already frozen, or chat is off: nothing to do.
    if (!server || !thread || thread.frozenAt) {
      freezing.delete(threadId)
      return
    }
    await server.freezeChannel(thread.streamChannelType, thread.streamChannelId)
    await ChatThreads.updateAsync(threadId, { $set: { frozenAt: new Date() } })
    freezing.delete(threadId)
  } catch (error) {
    console.error('chat', 'freeze failed', threadId, errorName(error))
    Meteor.setTimeout(
      () => void freezeAttempt(threadId, attempt + 1),
      freezeRetryDelay(attempt),
    )
  }
}

/**
 * Freezes a retired thread's channel: history stays readable, nobody can
 * post, so nothing more is pushed (docs/spec.md §2.4). `updatePartial`, so
 * there's no system message. Retried with backoff until it lands, then
 * records `frozenAt`. Resolves after the first attempt; never throws.
 */
function freezeWithRetry(threadId: string) {
  if (freezing.has(threadId)) return Promise.resolve()
  freezing.add(threadId)
  return freezeAttempt(threadId, 0)
}

/**
 * Freezes every retired thread whose freeze never landed, e.g. one whose
 * retry the last server run didn't live to finish. Run at startup.
 */
export async function freezeRetiredThreads() {
  const pending = await ChatThreads.find(
    { retiredAt: { $exists: true }, frozenAt: { $exists: false } },
    { fields: { _id: 1 } },
  ).fetchAsync()
  for (const { _id } of pending) await freezeWithRetry(_id)
}

// Pushes each thread it retires onto `retired`, even if it throws later.
async function syncEvent(
  server: ChatServer,
  eventId: string,
  retired: ChatThreadRecord[],
) {
  const event = await Events.findOneAsync(eventId)
  if (!event) return
  const wanted = wantedThreads(event)
  const live = await ChatThreads.find({
    eventId,
    retiredAt: { $exists: false },
  }).fetchAsync()

  // Retire first, so a Stream failure later never leaves a thread live for
  // someone who must lose it: mute it, then retire it in Mongo even if the
  // mute failed. A thread is never edited to drop the person it's about
  // (backend ADR 0001).
  const kept: ChatThreadRecord[] = []
  for (const thread of live) {
    const stillWanted =
      thread.kind === 'event' ||
      wanted.some(
        w => w.recipientParticipantId === thread.recipientParticipantId,
      )
    const recipient = recipientUserId(event, thread)
    if (stillWanted && !(recipient && thread.memberIds.includes(recipient))) {
      kept.push(thread)
    } else {
      await muteMembers(server, thread)
      await ChatThreads.updateAsync(thread._id, {
        $set: { retiredAt: new Date() },
      })
      retired.push(thread)
    }
  }

  const changes = wanted.map(want => {
    const thread = kept.find(
      t =>
        t.kind === want.kind &&
        t.recipientParticipantId === want.recipientParticipantId,
    )
    const current = thread?.memberIds ?? []
    return {
      want,
      thread,
      added: want.memberIds.filter(id => !current.includes(id)),
      removed: current.filter(id => !want.memberIds.includes(id)),
    }
  })

  // Stream only takes members, and a creator, it already knows.
  const newcomers = new Set(
    changes.flatMap(c => (c.thread ? c.added : c.want.memberIds)),
  )
  if (newcomers.size > 0 || changes.some(c => !c.thread)) {
    await upsertMembersAndCreator(server, [...newcomers])
  }

  for (const { want, thread, added, removed } of changes) {
    if (!thread) {
      const streamChannelId = Random.secret()
      await server.createChannel(want.streamChannelType, streamChannelId, {
        members: want.memberIds,
        created_by_id: CHAT_SERVER_USER_ID,
        eventId,
      })
      await ChatThreads.insertAsync({ eventId, ...want, streamChannelId })
      continue
    }
    if (added.length > 0) {
      // A new member reads the thread from the start.
      await server.addMembers(
        thread.streamChannelType,
        thread.streamChannelId,
        added,
        { hide_history: false },
      )
    }
    if (removed.length > 0) {
      await server.removeMembers(
        thread.streamChannelType,
        thread.streamChannelId,
        removed,
      )
    }
    if (added.length > 0 || removed.length > 0) {
      await ChatThreads.updateAsync(thread._id, {
        $set: { memberIds: want.memberIds },
      })
    }
  }
}

// The rows go whatever Stream says: the event is gone, so no later sync
// would ever retry, and nothing may point at it.
async function deleteEventThreads(server: ChatServer | null, eventId: string) {
  const threads = await ChatThreads.find({ eventId }).fetchAsync()
  try {
    if (server && threads.length > 0) {
      await server.deleteChannels(threads.map(cidOf), { hard_delete: true })
    }
  } finally {
    await ChatThreads.removeAsync({ eventId })
  }
}

// One chat change at a time per event, so two joins can't each miss the
// other's thread.
const queues = new Map<string, Promise<void>>()

function enqueue(eventId: string, what: string, run: () => Promise<void>) {
  const previous = queues.get(eventId) ?? Promise.resolve()
  const next = previous.then(async () => {
    try {
      await run()
    } catch (error) {
      // The event change stands. Mongo only records what reached Stream, so
      // the next sync of this event retries the rest.
      console.error('chat', what, 'failed', eventId, errorName(error))
    }
  })
  queues.set(eventId, next)
  void next.then(() => {
    if (queues.get(eventId) === next) queues.delete(eventId)
  })
  return next
}

/**
 * Brings the event's Stream channels in line with its participants and kind:
 * creates missing threads, adds and removes members, and retires a thread
 * whose recipient is gone or no longer a recipient. Call it after any
 * membership change. Never throws: a Stream failure is logged, and caught up
 * by the next sync. Does nothing while chat is off.
 */
export const syncChatThreads = (eventId: string) =>
  enqueue(eventId, 'sync', async () => {
    const server = chatServer()
    if (!server) return
    const retired: ChatThreadRecord[] = []
    try {
      await syncEvent(server, eventId, retired)
    } finally {
      // Last, as the replacement comes first, and whatever Stream said.
      for (const thread of retired) await freezeWithRetry(thread._id)
    }
  })

/**
 * Hard-deletes every Stream channel of a deleted event, and its threads.
 * Never throws.
 */
export const deleteChatThreads = (eventId: string) =>
  enqueue(eventId, 'delete', () => deleteEventThreads(chatServer(), eventId))
