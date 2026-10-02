import { Meteor } from 'meteor/meteor'

import { Notifications } from './notifications.collection'

// How many the inbox shows, and so how many ever reach the client.
const MAX_NOTIFICATIONS = 50

// The caller's own notifications, newest first.
Meteor.publish('notifications.mine', function () {
  if (!this.userId) return this.ready()
  return Notifications.find(
    { userId: this.userId },
    { sort: { createdAt: -1 }, limit: MAX_NOTIFICATIONS },
  )
})
