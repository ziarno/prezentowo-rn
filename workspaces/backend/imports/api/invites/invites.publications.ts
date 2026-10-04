import type { EventDoc, InviteDoc, NotificationDoc } from '@prezentowo/types'
import { check } from 'meteor/check'
import { Meteor } from 'meteor/meteor'

import { Events } from '../events/events.collection'
import { Notifications } from '../notifications/notifications.collection'
import { Invites } from './invites.collection'
import { invitePreview, profilesFor } from './invites.preview'

// A client-only collection: nothing on the server is stored under this name.
const INVITE_PREVIEWS = 'invitePreviews'
// Client-only too: one `DeferredInvite` per event.
const DEFERRED_INVITES = 'deferredInvites'

// Meteor 3 exposes the async observers on cursors, but the bundled type defs
// lag behind — narrow the cursor to the shape we use.
type ObserveCursor<T> = {
  observeAsync: (callbacks: {
    added?: (doc: T) => void
    changed?: (doc: T) => void
    removed?: (doc: T) => void
  }) => Promise<{ stop: () => void }>
}
const observable = <T>(cursor: unknown) => cursor as ObserveCursor<T>

// `7a`'s data, readable signed out: one `InvitePreview` (keyed by its code)
// kept live while the code stays valid, and removed once it's rotated away or
// the event is gone. An unknown code publishes nothing. Names are read again
// on every change to the event, so a rename shows up with the next one.
Meteor.publish('invites.byCode', async function (code: string) {
  check(code, String)

  let invite: InviteDoc | null = null
  let eventHandle: { stop: () => void } | null = null
  let shown = false
  // Updates wait on a profile lookup, so they're chained to stay in order.
  let queue = Promise.resolve()
  const enqueue = (step: () => void | Promise<void>) => {
    queue = queue.then(step).catch(error => this.error(error as Error))
  }

  const hide = () => {
    if (!shown) return
    shown = false
    this.removed(INVITE_PREVIEWS, code)
  }

  const show = async (event: EventDoc) => {
    const profileOf = await profilesFor(event)
    if (!invite) return
    const preview = invitePreview(code, event, profileOf, this.userId)
    if (shown) {
      // A cleared background has to be sent as undefined to clear it.
      this.changed(INVITE_PREVIEWS, code, { background: undefined, ...preview })
    } else {
      shown = true
      this.added(INVITE_PREVIEWS, code, preview)
    }
  }

  const inviteHandle = await observable<InviteDoc>(
    Invites.find({ code }),
  ).observeAsync({
    added: doc => void (invite = doc),
    // The code was rotated (or the event deleted): it's dead from now on.
    removed: () => {
      invite = null
      eventHandle?.stop()
      enqueue(hide)
    },
  })
  this.onStop(() => {
    inviteHandle.stop()
    eventHandle?.stop()
  })
  if (!invite) return this.ready()
  const { eventId } = invite as InviteDoc

  eventHandle = await observable<EventDoc>(
    Events.find({ _id: eventId }),
  ).observeAsync({
    added: event => enqueue(() => show(event)),
    changed: event => enqueue(() => show(event)),
    removed: () => enqueue(hide),
  })
  if (!invite) eventHandle.stop()

  await queue
  this.ready()
})

// The event's `InviteDoc`, for `6a`'s link row and the drawer's share. Only
// the event's creator gets it.
Meteor.publish('invites.forEvent', async function (eventId: string) {
  check(eventId, String)
  if (!this.userId) return this.ready()

  const event = await Events.findOneAsync(eventId)
  if (!event || event.ownerId !== this.userId) return this.ready()

  return Invites.find({ eventId })
})

// The notifications inbox's view of every invite waiting for the caller,
// whether they set it aside with Ignore or were invited from `4d`: one
// `DeferredInvite` per event with an `invite-deferred` or `invited`, keyed by
// event. The notification keeps only the eventId so a rotate never orphans it
// (#11); this follows the event's current code instead. Title and inviter are
// read when the invite is added.
Meteor.publish('invites.deferred', async function () {
  if (!this.userId) return this.ready()

  const watched = new Map<string, { stop: () => void }>()
  // How many of the caller's notifications name each event: an event may have
  // both kinds, and is shown until the last goes.
  const counts = new Map<string, number>()
  const shown = new Set<string>()
  let stopped = false
  // Each watch waits on lookups, so adds and removes are chained in order.
  let queue = Promise.resolve()
  const enqueue = (step: () => void | Promise<void>) => {
    queue = queue.then(step).catch(error => this.error(error as Error))
  }

  const hide = (eventId: string) => {
    if (shown.delete(eventId)) this.removed(DEFERRED_INVITES, eventId)
  }

  const unwatch = (eventId: string) => {
    watched.get(eventId)?.stop()
    watched.delete(eventId)
    hide(eventId)
  }

  const watch = async (eventId: string) => {
    const event = await Events.findOneAsync(eventId)
    if (!event || stopped) return
    const owner = await Meteor.users.findOneAsync(event.ownerId, {
      fields: { 'profile.name': 1 },
    })
    const inviterName = (owner?.profile as { name?: string })?.name ?? ''

    const handle = await observable<InviteDoc>(
      Invites.find({ eventId }),
    ).observeAsync({
      added: invite => {
        shown.add(eventId)
        this.added(DEFERRED_INVITES, eventId, {
          eventId,
          code: invite.code,
          title: event.title,
          inviterName,
        })
      },
      changed: invite =>
        this.changed(DEFERRED_INVITES, eventId, { code: invite.code }),
      removed: () => hide(eventId),
    })
    if (stopped) return handle.stop()
    watched.set(eventId, handle)
  }

  const notificationsHandle = await observable<NotificationDoc>(
    Notifications.find(
      { userId: this.userId, kind: { $in: ['invite-deferred', 'invited'] } },
      { fields: { eventId: 1 } },
    ),
  ).observeAsync({
    added: n => {
      const count = (counts.get(n.eventId) ?? 0) + 1
      counts.set(n.eventId, count)
      if (count === 1) enqueue(() => watch(n.eventId))
    },
    removed: n => {
      const count = (counts.get(n.eventId) ?? 1) - 1
      if (count > 0) return void counts.set(n.eventId, count)
      counts.delete(n.eventId)
      enqueue(() => unwatch(n.eventId))
    },
  })
  this.onStop(() => {
    stopped = true
    notificationsHandle.stop()
    for (const handle of watched.values()) handle.stop()
  })

  await queue
  this.ready()
})
