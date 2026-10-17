import type { EventDoc, GiftDoc } from '@prezentowo/types'
import { check } from 'meteor/check'
import { Meteor } from 'meteor/meteor'

import { watchMembership } from '../events/events.membership'
import { Gifts } from './gifts.collection'
import { isHiddenFrom, isRecipient } from './gifts.visibility'

// Meteor 3.4 exposes `observeChangesAsync` on cursors, but the bundled type
// defs lag behind — narrow the cursor to the shape we use.
type ObserveFields = Partial<GiftDoc> & Record<string, unknown>
type AsyncObservableCursor = {
  observeChangesAsync: (callbacks: {
    added?: (id: string, fields: ObserveFields) => void
    changed?: (id: string, fields: ObserveFields) => void
    removed?: (id: string) => void
  }) => Promise<{ stop: () => void }>
}

// Gifts for an event, with both recipient rules applied per viewer:
// - Own-list visibility rule: a gift suggested for the viewer is never added,
//   and its later changes and removal are skipped (`hiddenIds`).
// - Claim-quietly rule: the viewer's self-added gifts have `claimedBy`
//   stripped, so they never learn whether — or by whom — they're reserved.
// No owner exemption. Everyone else sees every gift with its full claim state.
// Only while the viewer stays a member: their removal ends it.
Meteor.publish('gifts.byEvent', async function (eventId: string) {
  check(eventId, String)
  const userId = this.userId
  if (!userId) return this.ready()

  // Both rules only ask which participant is the viewer, and that's fixed
  // while the subscription runs: a member's entry is never reassigned (a
  // placeholder is claimed by someone joining, who wasn't a member yet), and
  // its removal stops the subscription. So this snapshot never goes stale.
  const event = await watchMembership(this, eventId, userId)
  if (!event) return this.ready()

  const mineIds = new Set<string>()
  const hiddenIds = new Set<string>()

  const cursor = Gifts.find(
    { eventId },
    { fields: { clientId: 0 } },
  ) as unknown as AsyncObservableCursor
  const handle = await cursor.observeChangesAsync({
    added: (id, fields) => {
      const gift = fields as GiftDoc
      if (isHiddenFrom(event, gift, userId)) {
        hiddenIds.add(id)
        return
      }
      const out = { ...fields }
      if (isRecipient(event, gift, userId)) {
        mineIds.add(id)
        delete out.claimedBy
      }
      this.added('gifts', id, out)
    },
    changed: (id, fields) => {
      if (hiddenIds.has(id)) return
      const out = { ...fields }
      if (mineIds.has(id) && 'claimedBy' in out) delete out.claimedBy
      this.changed('gifts', id, out)
    },
    removed: id => {
      if (hiddenIds.delete(id)) return
      mineIds.delete(id)
      this.removed('gifts', id)
    },
  })

  this.ready()
  this.onStop(() => handle.stop())
})

// Meteor.users' cursors have `observeChangesAsync` too, under the same lag.
type AsyncObservableUsers = {
  observeChangesAsync: (callbacks: {
    added?: (id: string, fields: Record<string, unknown>) => void
    changed?: (id: string, fields: Record<string, unknown>) => void
    removed?: (id: string) => void
  }) => Promise<{ stop: () => void }>
}

const PROFILE_FIELDS = {
  'profile.name': 1,
  'profile.avatar': 1,
  'profile.photo': 1,
}

const realUserIds = (event: EventDoc) =>
  event.participants.flatMap(p => (p.kind === 'real' ? [p.userId] : []))

// Minimal profiles (name, avatar, photo) for the real participants of an
// event, so the client can render their names and pictures in the
// event/people screens.
// Follows the participant list while it runs: someone joining has their
// profile added, someone leaving it taken back.
// Only while the viewer stays a member: their removal ends it.
Meteor.publish('users.inEvent', async function (eventId: string) {
  check(eventId, String)
  if (!this.userId) return this.ready()

  // One observer per real participant. `live` drops callbacks from an
  // observer already let go of; `sent` says whether its profile is out.
  type Follow = {
    live: boolean
    sent: boolean
    handle: Promise<{ stop: () => void }>
  }
  const follows = new Map<string, Follow>()
  let latest: EventDoc | undefined
  let started = false
  let stopped = false

  const follow = (userId: string): Follow => {
    const f = { live: true, sent: false } as Follow
    const cursor = Meteor.users.find(
      { _id: userId },
      { fields: PROFILE_FIELDS },
    ) as unknown as AsyncObservableUsers
    f.handle = cursor.observeChangesAsync({
      added: (id, fields) => {
        if (!f.live) return
        f.sent = true
        this.added('users', id, fields)
      },
      changed: (id, fields) => {
        if (f.live) this.changed('users', id, fields)
      },
      removed: id => {
        if (!f.live) return
        f.sent = false
        this.removed('users', id)
      },
    })
    return f
  }

  const letGo = (f: Follow) => {
    f.live = false
    void f.handle.then(h => h.stop())
  }

  // Always against the newest event seen, so a change that lands before the
  // first read is in hand isn't undone by it.
  const sync = () => {
    if (!started || stopped || !latest) return
    const userIds = new Set(realUserIds(latest))
    for (const [userId, f] of follows) {
      if (userIds.has(userId)) continue
      follows.delete(userId)
      letGo(f)
      if (f.sent) this.removed('users', userId)
    }
    for (const userId of userIds) {
      if (!follows.has(userId)) follows.set(userId, follow(userId))
    }
  }

  this.onStop(() => {
    stopped = true
    follows.forEach(letGo)
  })

  const event = await watchMembership(this, eventId, this.userId, doc => {
    latest = doc
    sync()
  })
  if (!event) return this.ready()

  latest ??= event
  started = true
  sync()
  await Promise.all([...follows.values()].map(f => f.handle))
  this.ready()
})
