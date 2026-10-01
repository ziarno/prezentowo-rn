import type { ActivityDoc, EventDoc } from '@prezentowo/types'
import { check } from 'meteor/check'
import { Meteor } from 'meteor/meteor'

import { Events } from '../events/events.collection'
import {
  memberEventsSelector,
  participantIdOf,
  watchMembership,
} from '../events/events.membership'
import { Activity } from './activity.collection'

// Meteor 3 exposes the async observers on cursors, but the bundled type defs
// lag behind — narrow the cursors to the shapes we use.
type Fields = Partial<ActivityDoc> & Record<string, unknown>
type ObservableActivity = {
  observeChangesAsync: (callbacks: {
    added: (id: string, fields: Fields) => void
    changed: (id: string, fields: Fields) => void
    removed: (id: string) => void
  }) => Promise<{ stop: () => void }>
}
type ObservableEvents = {
  observeAsync: (callbacks: {
    added: (event: EventDoc) => void
    removed: (event: EventDoc) => void
  }) => Promise<{ stop: () => void }>
}

/**
 * The one filter every activity publication applies: `event`'s items, newest
 * first, minus those hidden from `userId`'s participant, and never the
 * `hiddenFromParticipantId` field itself. The viewer's participant id is
 * fixed while they're a member, and visibility is decided at insert, so the
 * cursor never goes stale.
 */
const visibleActivity = (event: EventDoc, userId: string, limit?: number) => {
  const viewer = participantIdOf(event, userId)
  return Activity.find(
    {
      eventId: event._id,
      ...(viewer ? { hiddenFromParticipantId: { $ne: viewer } } : {}),
    },
    {
      fields: { hiddenFromParticipantId: 0 },
      sort: { createdAt: -1 },
      ...(limit ? { limit } : {}),
    },
  )
}

// The event feed (`3c`). Only while the viewer stays a member: their removal
// ends it.
Meteor.publish('activity.byEvent', async function (eventId: string) {
  check(eventId, String)
  if (!this.userId) return this.ready()

  const event = await watchMembership(this, eventId, this.userId)
  if (!event) return this.ready()

  return visibleActivity(event, this.userId)
})

// How many items Home (`3a`) shows per event.
const RECENT_PER_EVENT = 3

// Home's (`3a`) recent items: the newest few per event, across every event
// the caller is a member of. An event they join is followed from then on; one
// they leave, or that's deleted, has its items taken back.
Meteor.publish('activity.recentForUser', async function () {
  if (!this.userId) return this.ready()
  const userId = this.userId

  const perEvent = new Map<
    string,
    { handle: { stop: () => void }; shown: Set<string> }
  >()
  let stopped = false

  // Starting a feed is async, so membership changes are chained to stay in
  // order: an event's feed is always started before it can be stopped.
  let queue = Promise.resolve()
  const enqueue = (step: () => void | Promise<void>) => {
    queue = queue.then(step).catch(error => this.error(error as Error))
  }

  const follow = async (event: EventDoc) => {
    const shown = new Set<string>()
    const cursor = visibleActivity(
      event,
      userId,
      RECENT_PER_EVENT,
    ) as unknown as ObservableActivity
    const handle = await cursor.observeChangesAsync({
      added: (id, fields) => {
        shown.add(id)
        this.added('activity', id, fields)
      },
      changed: (id, fields) => this.changed('activity', id, fields),
      removed: id => {
        shown.delete(id)
        this.removed('activity', id)
      },
    })
    if (stopped) return handle.stop()
    perEvent.set(event._id, { handle, shown })
  }

  const unfollow = (eventId: string) => {
    const feed = perEvent.get(eventId)
    if (!feed) return
    perEvent.delete(eventId)
    feed.handle.stop()
    feed.shown.forEach(id => this.removed('activity', id))
  }

  // As `events.mine`: an event leaves this query once the caller stops being
  // a member, and re-enters it, with their new participant, if they rejoin.
  const events = Events.find(
    memberEventsSelector(userId),
  ) as unknown as ObservableEvents
  const eventsHandle = await events.observeAsync({
    added: event => enqueue(() => follow(event)),
    removed: event => enqueue(() => unfollow(event._id)),
  })

  this.onStop(() => {
    stopped = true
    eventsHandle.stop()
    for (const { handle } of perEvent.values()) handle.stop()
    perEvent.clear()
  })

  await queue
  this.ready()
})
