import { Meteor } from 'meteor/meteor'

import { PushTokens } from '../push/push.collection'
import type { ChatServer, StreamUser } from './chat.server'

/**
 * `userIds` as Stream users, whole: the profile name, and the language of
 * the device registered last (docs/spec.md §2.4). Stream replaces a user on
 * every upsert, so each one goes through here or it drops the language.
 */
export async function streamUsers(userIds: string[]): Promise<StreamUser[]> {
  const users = await Meteor.users
    .find({ _id: { $in: userIds } }, { fields: { 'profile.name': 1 } })
    .fetchAsync()
  const tokens = await PushTokens.find(
    { userId: { $in: userIds } },
    { sort: { updatedAt: 1 }, fields: { userId: 1, locale: 1 } },
  ).fetchAsync()
  // Oldest first, so each user's latest device is the one the map keeps.
  const languages = new Map(tokens.map(t => [t.userId, t.locale]))
  return users.map(u => {
    const language = languages.get(u._id)
    return { id: u._id, name: u.profile?.name, ...(language && { language }) }
  })
}

/** Upserts `userIds` into Stream, whole (see `streamUsers`). */
export async function upsertStreamUsers(server: ChatServer, userIds: string[]) {
  await server.upsertUsers(await streamUsers(userIds))
}
