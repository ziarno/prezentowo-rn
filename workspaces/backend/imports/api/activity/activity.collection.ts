import type { ActivityDoc } from '@prezentowo/types'
import { Meteor } from 'meteor/meteor'
import { Mongo } from 'meteor/mongo'

export const Activity = new Mongo.Collection<ActivityDoc>('activity')

export async function createActivityIndexes() {
  await Activity.createIndexAsync({ eventId: 1, createdAt: -1 })
}

Meteor.startup(createActivityIndexes)
