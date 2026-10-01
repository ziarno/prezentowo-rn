import { check } from 'meteor/check'
import { Meteor } from 'meteor/meteor'

import { Events } from './events.collection'
import { memberEventsSelector, watchMembership } from './events.membership'

// Events the current user owns or is a real participant of.
Meteor.publish('events.mine', function () {
  if (!this.userId) return this.ready()

  return Events.find(memberEventsSelector(this.userId))
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

  return Events.find({ _id: eventId })
})
