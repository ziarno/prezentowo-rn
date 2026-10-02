import { Meteor } from 'meteor/meteor'

import { Notifications } from './notifications.collection'

// The bell's "mark as read": every unread notification of the caller's.
const markAllRead = async function (this: Meteor.MethodThisType) {
  if (!this.userId) {
    throw new Meteor.Error('notAuthorized', 'mustBeLoggedIn')
  }
  await Notifications.updateAsync(
    { userId: this.userId, read: false },
    { $set: { read: true } },
    { multi: true },
  )
}

Meteor.methods({
  'notifications.markAllRead': markAllRead,
})
