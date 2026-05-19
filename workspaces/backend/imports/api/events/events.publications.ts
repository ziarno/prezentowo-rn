import { check } from 'meteor/check'
import { Meteor } from 'meteor/meteor'

import { Events } from './events.collection'

// Events the current user owns or is a real participant of.
Meteor.publish('events.mine', function () {
  if (!this.userId) return this.ready()

  return Events.find({
    $or: [
      { ownerId: this.userId },
      { participants: { $elemMatch: { kind: 'real', userId: this.userId } } },
    ],
  })
})

// A single event by id. Used by the join-event screen so a user who isn't a
// participant yet — or not even signed in yet — can see the event they're
// being invited to. The id acts as the invite capability.
Meteor.publish('events.byId', function (eventId: string) {
  check(eventId, String)
  return Events.find({ _id: eventId })
})
