import type { AppLanguage, RegisterPushArgs } from '@prezentowo/types'
import { Meteor } from 'meteor/meteor'
import { Mongo } from 'meteor/mongo'

// One per device: the Expo token for inbox pushes and the native token
// registered with Stream for chat pushes (docs/spec.md §2.1). Server-only,
// never published.
export type PushTokenDoc = {
  _id: string
  userId: string
  expoToken: string
  deviceToken: string
  platform: RegisterPushArgs['platform']
  locale: AppLanguage
  updatedAt: Date
}

export const PushTokens = new Mongo.Collection<PushTokenDoc>('pushTokens')

// A device belongs to one account at a time, whichever token it's found by.
export async function createPushTokenIndexes() {
  await PushTokens.createIndexAsync({ expoToken: 1 }, { unique: true })
  await PushTokens.createIndexAsync({ deviceToken: 1 }, { unique: true })
  await PushTokens.createIndexAsync({ userId: 1 })
}

Meteor.startup(createPushTokenIndexes)
