import type { EventDoc, InviteDoc, InvitePreview } from '@prezentowo/types'
import { check } from 'meteor/check'
import { Meteor } from 'meteor/meteor'

import { Events } from '../events/events.collection'
import { Invites } from './invites.collection'

// A client-only collection: nothing on the server is stored under this name.
const INVITE_PREVIEWS = 'invitePreviews'

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

type Profile = { name?: string; avatar?: string }

// Everything `7a` shows before joining. UserIds and gifts never leave the
// server: real participants go out by name and avatar, and placeholders are
// listed only while unclaimed.
const invitePreview = (
  code: string,
  event: EventDoc,
  profileOf: (userId: string) => Profile | undefined,
): InvitePreview => ({
  code,
  eventId: event._id,
  title: event.title,
  date: event.date,
  ...(event.background ? { background: event.background } : {}),
  inviterName: profileOf(event.ownerId)?.name ?? '',
  realParticipants: event.participants.flatMap(p => {
    if (p.kind !== 'real') return []
    const profile = profileOf(p.userId)
    return [
      {
        id: p.id,
        name: profile?.name ?? '',
        ...(profile?.avatar ? { avatar: profile.avatar } : {}),
      },
    ]
  }),
  unclaimedPlaceholders: event.participants.flatMap(p =>
    p.kind === 'placeholder'
      ? [
          {
            id: p.id,
            name: p.name,
            color: p.color,
            ...(p.avatar ? { avatar: p.avatar } : {}),
          },
        ]
      : [],
  ),
})

// The profiles of the event's creator and real participants.
async function profilesFor(event: EventDoc) {
  const userIds = [
    event.ownerId,
    ...event.participants.flatMap(p => (p.kind === 'real' ? [p.userId] : [])),
  ]
  const users = await Meteor.users
    .find(
      { _id: { $in: userIds } },
      { fields: { 'profile.name': 1, 'profile.avatar': 1 } },
    )
    .fetchAsync()
  const byId = new Map(users.map(u => [u._id, u.profile as Profile]))
  return (userId: string) => byId.get(userId)
}

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
    const preview = invitePreview(code, event, profileOf)
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
