import Meteor, { type MeteorError } from '@meteorrn/core'
import type { UpdateUserArgs } from '@prezentowo/types'

import type { Subscription } from './events'

export type CurrentUser = {
  _id: string
  createdAt?: Date | string
  emails?: { address: string; verified: boolean }[]
  profile?: { name?: string; avatar?: string }
}

export type PublicUser = {
  _id: string
  profile?: { name?: string; avatar?: string }
}

export function getCurrentUser(): CurrentUser | undefined {
  return Meteor.user() as CurrentUser | undefined
}

// Subscribes to the minimal profiles of an event's real participants, so the
// client can render their names and avatars (see `users.inEvent` publication).
export function subscribeToEventUsers(eventId: string): Subscription {
  const subId = Meteor.getData().ddp.sub('users.inEvent', [eventId])
  return { stop: () => Meteor.getData().ddp.unsub(subId) }
}

// `Meteor.users` exists at runtime (a Mongo.Collection) but isn't in the
// @meteorrn/core type surface, so reach it through a narrow cast.
const usersCollection = (
  Meteor as unknown as {
    users: { findOne: (selector: string) => PublicUser | undefined }
  }
).users

export function findUserById(userId: string): PublicUser | undefined {
  return usersCollection.findOne(userId)
}

export function updateUser(args: UpdateUserArgs): Promise<void> {
  return new Promise((resolve, reject) => {
    Meteor.call('updateUser', args, (err: MeteorError | undefined) => {
      if (err) return reject(err)
      resolve()
    })
  })
}
