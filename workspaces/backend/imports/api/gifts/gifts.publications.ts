import type { GiftDoc } from '@prezentowo/types'
import { check } from 'meteor/check'
import { Meteor } from 'meteor/meteor'

import { Events } from '../events/events.collection'
import { Gifts } from './gifts.collection'

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

const isMemberOf = (
  event: { ownerId: string; participants: { kind: string; userId?: string }[] },
  userId: string,
): boolean =>
  event.ownerId === userId ||
  event.participants.some(p => p.kind === 'real' && p.userId === userId)

// Gifts for an event. The core "claim quietly" rule lives here: a gift that is
// for the current user has its `claimedBy` field stripped before it reaches the
// client, so the recipient can never see whether — or by whom — their own gifts
// have been reserved. Everyone else sees the full claim state.
Meteor.publish('gifts.byEvent', async function (eventId: string) {
  check(eventId, String)
  if (!this.userId) return this.ready()

  const event = await Events.findOneAsync(eventId)
  if (!event || !isMemberOf(event, this.userId)) return this.ready()

  const myParticipantId = event.participants.find(
    p => p.kind === 'real' && p.userId === this.userId,
  )?.id

  const mineIds = new Set<string>()
  const isMine = (forParticipantId?: unknown) =>
    myParticipantId !== undefined && forParticipantId === myParticipantId

  const cursor = Gifts.find({ eventId }) as unknown as AsyncObservableCursor
  const handle = await cursor.observeChangesAsync({
    added: (id, fields) => {
      const out = { ...fields }
      if (isMine(fields.forParticipantId)) {
        mineIds.add(id)
        delete out.claimedBy
      }
      this.added('gifts', id, out)
    },
    changed: (id, fields) => {
      const out = { ...fields }
      if (mineIds.has(id) && 'claimedBy' in out) delete out.claimedBy
      this.changed('gifts', id, out)
    },
    removed: id => {
      mineIds.delete(id)
      this.removed('gifts', id)
    },
  })

  this.ready()
  this.onStop(() => handle.stop())
})

// Minimal profiles (name + avatar) for the real participants of an event, so
// the client can render their names and avatars in the event/people screens.
Meteor.publish('users.inEvent', async function (eventId: string) {
  check(eventId, String)
  if (!this.userId) return this.ready()

  const event = await Events.findOneAsync(eventId)
  if (!event || !isMemberOf(event, this.userId)) return this.ready()

  const userIds = event.participants
    .filter((p): p is typeof p & { userId: string } => p.kind === 'real')
    .map(p => p.userId)

  return Meteor.users.find(
    { _id: { $in: userIds } },
    { fields: { 'profile.name': 1, 'profile.avatar': 1 } },
  )
})
