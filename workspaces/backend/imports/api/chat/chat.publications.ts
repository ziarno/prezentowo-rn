import { check } from 'meteor/check'
import { Meteor } from 'meteor/meteor'

import { participantIdOf, watchMembership } from '../events/events.membership'
import { ChatThreads } from './chat.collection'

// The event's live threads the viewer is a member of, for members only. The
// viewer is never a member of their own secret thread; the recipient filter
// says so a second time.
Meteor.publish('chatThreads.byEvent', async function (eventId: string) {
  check(eventId, String)
  if (!this.userId) return this.ready()

  const event = await watchMembership(this, eventId, this.userId)
  if (!event) return this.ready()

  return ChatThreads.find(
    {
      eventId,
      retiredAt: { $exists: false },
      memberIds: this.userId,
      recipientParticipantId: { $ne: participantIdOf(event, this.userId) },
    },
    { fields: { memberIds: 0 } },
  )
})
