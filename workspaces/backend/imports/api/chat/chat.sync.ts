import type { EventDoc } from '@prezentowo/types'
import { Meteor } from 'meteor/meteor'
import { Random } from 'meteor/random'

import { Events } from '../events/events.collection'
import { type ChatThreadRecord, ChatThreads } from './chat.collection'
import { CHAT_SERVER_USER_ID, type ChatServer, chatServer } from './chat.server'

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

// Upserts `userIds` with their names, and the channel creator.
async function upsertNamedUsers(server: ChatServer, userIds: string[]) {
  const users = await Meteor.users
    .find({ _id: { $in: userIds } }, { fields: { 'profile.name': 1 } })
    .fetchAsync()
  await server.upsertUsers([
    { id: CHAT_SERVER_USER_ID, name: 'Prezentowo' },
    ...users.map(u => ({ id: u._id, name: u.profile?.name })),
  ])
}

async function syncEvent(server: ChatServer, eventId: string) {
  const event = await Events.findOneAsync(eventId)
  if (!event) return
  const wanted = wantedThreads(event)
  const live = await ChatThreads.find({
    eventId,
    retiredAt: { $exists: false },
  }).fetchAsync()

  // Retire first, and in Mongo alone, so a Stream failure later never leaves
  // a thread live for someone who must lose it. A thread is never edited to
  // drop the person it's about (backend ADR 0001).
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
      await ChatThreads.updateAsync(thread._id, {
        $set: { retiredAt: new Date() },
      })
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
    await upsertNamedUsers(server, [...newcomers])
  }

  for (const { want, thread, added, removed } of changes) {
    if (!thread) {
      const streamChannelId = Random.secret()
      await server.createChannel(want.streamChannelType, streamChannelId, {
        members: want.memberIds,
        created_by_id: CHAT_SERVER_USER_ID,
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

const errorName = (error: unknown) =>
  error instanceof Error ? error.name : typeof error

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
    if (server) await syncEvent(server, eventId)
  })

/**
 * Hard-deletes every Stream channel of a deleted event, and its threads.
 * Never throws.
 */
export const deleteChatThreads = (eventId: string) =>
  enqueue(eventId, 'delete', () => deleteEventThreads(chatServer(), eventId))
