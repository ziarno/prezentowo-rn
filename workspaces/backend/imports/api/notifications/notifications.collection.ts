import type { NotificationDoc } from '@prezentowo/types'
import { Meteor } from 'meteor/meteor'
import { Mongo } from 'meteor/mongo'

export const Notifications = new Mongo.Collection<NotificationDoc>(
  'notifications',
)

export async function createNotificationIndexes() {
  await Notifications.createIndexAsync({ userId: 1, createdAt: -1 })
  // One deferred invite and one invitation per user and event, so ignoring
  // twice is a no-op. Named, since it replaces an index on the same keys
  // that covered `invite-deferred` alone.
  await Notifications.createIndexAsync(
    { userId: 1, eventId: 1, kind: 1 },
    {
      name: 'oneInvitePerUserAndEvent',
      unique: true,
      partialFilterExpression: {
        kind: { $in: ['invite-deferred', 'invited'] },
      },
    },
  )
}

Meteor.startup(createNotificationIndexes)
