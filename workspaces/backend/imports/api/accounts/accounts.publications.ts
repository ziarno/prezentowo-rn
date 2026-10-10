import { Meteor, type Subscription } from 'meteor/meteor'

// Meteor's own unnamed publication sends the signed-in user their `profile`,
// `username` and `emails`. This adds `createdAt`, for Profile's "Joined"
// (docs/spec.md §10.1); the client merges both into one document.
export function ownAccount(this: Subscription) {
  if (!this.userId) return this.ready()
  return Meteor.users.find(this.userId, { fields: { createdAt: 1 } })
}

Meteor.publish(null, ownAccount)
