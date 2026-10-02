import { findEventById } from '@/api/events'
import { mirror } from '@/sync'

// What the offline cache keeps of each publication (docs/spec.md §6.2): the
// client-side docs it sends, per collection. A scope may cover more than the
// publication sends, never less. Publications not listed here aren't kept —
// `invites.byCode` is online-only, since joining is.

const byEvent = ([eventId]: unknown[]) => eventId as string

mirror('events.mine', { scope: () => ({ events: {} }), listsEvents: true })
mirror('events.byId', {
  scope: ([eventId]) => ({ events: { _id: eventId } }),
  eventId: byEvent,
})

mirror('gifts.byEvent', {
  scope: ([eventId]) => ({ gifts: { eventId } }),
  eventId: byEvent,
})

// Its real participants' minimal profiles.
mirror('users.inEvent', {
  scope: ([eventId]) => {
    const event = findEventById(eventId as string)
    const userIds = (event?.participants ?? []).flatMap(p =>
      p.kind === 'real' ? [p.userId] : [],
    )
    return { users: { _id: { $in: userIds } } }
  },
  eventId: byEvent,
})

mirror('activity.byEvent', {
  scope: ([eventId]) => ({ activity: { eventId } }),
  eventId: byEvent,
})
mirror('activity.recentForUser', { scope: () => ({ activity: {} }) })

mirror('notifications.mine', { scope: () => ({ notifications: {} }) })
mirror('invites.deferred', { scope: () => ({ deferredInvites: {} }) })
mirror('invites.forEvent', {
  scope: ([eventId]) => ({ invites: { eventId } }),
  eventId: byEvent,
})
