import type { NotificationDoc } from '@prezentowo/types'
import { Meteor } from 'meteor/meteor'
import { Mongo } from 'meteor/mongo'

export const Notifications = new Mongo.Collection<NotificationDoc>(
  'notifications',
)

export async function createNotificationIndexes() {
  await Notifications.createIndexAsync({ userId: 1, createdAt: -1 })
  // One deferred invite per user and event, so ignoring twice is a no-op.
  await Notifications.createIndexAsync(
    { userId: 1, eventId: 1, kind: 1 },
    {
      unique: true,
      partialFilterExpression: { kind: 'invite-deferred' },
    },
  )
}

Meteor.startup(createNotificationIndexes)
