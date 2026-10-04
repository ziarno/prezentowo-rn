import { check } from 'meteor/check'
import { Meteor } from 'meteor/meteor'

import { Events } from './events.collection'
import { memberEventsSelector, watchMembership } from './events.membership'

// A reserved placeholder looks like any other placeholder to members: who it
// is reserved for never leaves the server.
const PUBLIC_FIELDS = { fields: { 'participants.invitedUserId': 0 } } as const

// Events the current user owns or is a real participant of.
Meteor.publish('events.mine', function () {
  if (!this.userId) return this.ready()

  return Events.find(memberEventsSelector(this.userId), PUBLIC_FIELDS)
})

// A single event, for its members only, and only while they stay one. It is
// not an invite path: invites go through `invites.byCode`, and an eventId
// grants nothing.
Meteor.publish('events.byId', async function (eventId: string) {
  check(eventId, String)
  if (!this.userId) return this.ready()

  if (!(await watchMembership(this, eventId, this.userId))) {
    return this.ready()
  }

  return Events.find({ _id: eventId }, PUBLIC_FIELDS)
})
