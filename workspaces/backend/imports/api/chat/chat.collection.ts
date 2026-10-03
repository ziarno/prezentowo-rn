import type { ChatThreadDoc } from '@prezentowo/types'
import { Meteor } from 'meteor/meteor'
import { Mongo } from 'meteor/mongo'

// A stored thread. `memberIds` mirrors the Stream channel's members as last
// written, so a sync only calls Stream for what changed; server-only, never
// published (see chatThreads.byEvent).
export type ChatThreadRecord = ChatThreadDoc & { memberIds: string[] }

export const ChatThreads = new Mongo.Collection<ChatThreadRecord>('chatThreads')

export async function createChatThreadIndexes() {
  await ChatThreads.createIndexAsync({ eventId: 1 })
}

Meteor.startup(createChatThreadIndexes)
