import type { UpdateUserArgs } from '@prezentowo/types'

import { call, currentUser, findUser } from '@/sync'

// A user's picture is `photo` (an upload id) when set, else the stock
// `avatar` key (docs/spec.md §1.10).
export type Profile = { name?: string; avatar?: string; photo?: string }

export type CurrentUser = {
  _id: string
  createdAt?: Date | string
  emails?: { address: string; verified: boolean }[]
  profile?: Profile
}

export type PublicUser = {
  _id: string
  profile?: Profile
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
