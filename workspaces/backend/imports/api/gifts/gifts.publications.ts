import type { GiftDoc } from '@prezentowo/types'
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

// Minimal profiles (name, avatar, photo) for the real participants of an
// event, so the client can render their names and pictures in the
// event/people screens.
// Only while the viewer stays a member: their removal ends it.
Meteor.publish('users.inEvent', async function (eventId: string) {
  check(eventId, String)
  if (!this.userId) return this.ready()

  const event = await watchMembership(this, eventId, this.userId)
  if (!event) return this.ready()

  const userIds = event.participants
    .filter((p): p is typeof p & { userId: string } => p.kind === 'real')
    .map(p => p.userId)

  return Meteor.users.find(
    { _id: { $in: userIds } },
    {
      fields: { 'profile.name': 1, 'profile.avatar': 1, 'profile.photo': 1 },
    },
  )
})
