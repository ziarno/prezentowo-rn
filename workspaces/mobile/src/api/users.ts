import type { UpdateUserArgs } from '@prezentowo/types'

import { call, currentUser, findUser } from '@/sync'

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
  return currentUser<CurrentUser>()
}

// Minimal profiles of an event's real participants arrive through the
// `users.inEvent` publication.
export function findUserById(userId: string): PublicUser | undefined {
  return findUser<PublicUser>(userId)
}

export function updateUser(args: UpdateUserArgs): Promise<void> {
  return call('updateUser', args)
}
