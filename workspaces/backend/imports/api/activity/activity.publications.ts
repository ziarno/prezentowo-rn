import type { EventDoc } from '@prezentowo/types'
import { check } from 'meteor/check'
import { Meteor } from 'meteor/meteor'

import { participantIdOf, watchMembership } from '../events/events.membership'
import { Activity } from './activity.collection'

/**
 * The feed's filter: `event`'s items, newest first, minus those hidden from
 * `userId`'s participant, and never the `hiddenFromParticipantId` field
 * itself. The viewer's participant id is
 * fixed while they're a member, and visibility is decided at insert, so the
 * cursor never goes stale.
 */
const visibleActivity = (event: EventDoc, userId: string) => {
  const viewer = participantIdOf(event, userId)
  return Activity.find(
    {
      eventId: event._id,
      ...(viewer ? { hiddenFromParticipantId: { $ne: viewer } } : {}),
    },
    { fields: { hiddenFromParticipantId: 0 }, sort: { createdAt: -1 } },
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
