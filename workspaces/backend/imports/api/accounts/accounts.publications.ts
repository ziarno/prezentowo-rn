import { Meteor, type Subscription } from 'meteor/meteor'

// Meteor's own unnamed publication sends the signed-in user their `profile`,
// `username` and `emails`. This adds `createdAt`, for Profile's "Joined"
// (docs/spec.md §10.1), `pushPreferences`, for the push settings (§10.2), and
// `ageBand`, for the first-login question (§1.15); the client merges them
// into one document.
export function ownAccount(this: Subscription) {
  if (!this.userId) return this.ready()
  return Meteor.users.find(this.userId, {
    fields: { createdAt: 1, pushPreferences: 1, ageBand: 1 },
  })
}

Meteor.publish(null, ownAccount)
