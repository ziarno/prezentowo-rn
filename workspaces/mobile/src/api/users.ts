import type {
  AgeAnswer,
  AgeBand,
  PushPreferences,
  SetAgeBandArgs,
  SetAgeBandResult,
  SetPushPreferenceArgs,
  UpdateUserArgs,
  UserStats,
} from '@prezentowo/types'

import { call, currentUser, findUser, saveRecord, savedRecord } from '@/sync'

// A user's picture is `photo` (an upload id) when set, else the stock
// `avatar` key (docs/spec.md §1.10).
export type Profile = { name?: string; avatar?: string; photo?: string }

export type CurrentUser = {
  _id: string
  createdAt?: Date | string
  emails?: { address: string; verified: boolean }[]
  profile?: Profile
  // Which pushes the user wants; a missing kind is on (docs/spec.md §1.13).
  pushPreferences?: PushPreferences
  // The first-login age answer; missing = not answered yet (§1.15). Only ever
  // on the user's own document.
  ageBand?: AgeBand
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

// First-login's age question (docs/spec.md §1.15). A band is stored; under-13
// deletes the account on the server, which the answer says (`deleted`), so
// the caller ends the session only then. Online-only, never queued.
export function setAgeBand(answer: AgeAnswer): Promise<SetAgeBandResult> {
  return call('users.setAgeBand', { answer } satisfies SetAgeBandArgs)
}

// Follows the account to every phone. Online-only, never queued.
export function setPushPreference(args: SetPushPreferenceArgs): Promise<void> {
  return call('users.setPushPreference', args)
}

const STATS_RECORD = 'stats'

// The last `UserStats` the server answered, kept in the encrypted store
// (docs/spec.md §10.3).
export const savedUserStats = () => savedRecord<UserStats>(STATS_RECORD)

// Counted fresh on the server. Online-only. The caller saves the answer with
// `saveUserStats` only if it's still the latest, so an older answer can't
// replace a newer one.
export const fetchUserStats = () => call<UserStats>('users.stats')

// Keeps it for the next launch and for offline.
export const saveUserStats = (stats: UserStats) =>
  saveRecord(STATS_RECORD, stats)
