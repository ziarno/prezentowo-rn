import { nameTokens } from '@prezentowo/types'
import { Accounts } from 'meteor/accounts-base'
import type { Meteor } from 'meteor/meteor'

/**
 * The `Meteor.users` fields to `$set` for a new `profile.name`: the name and
 * its `nameTokens`, which `users.search` matches on. Every write of the name
 * goes through here, or through account creation below.
 */
export const nameFields = (name: string) => ({
  'profile.name': name,
  nameTokens: nameTokens(name),
})

// Registration, the Dev login and every other account creation: keeps the
// profile as Meteor would without a hook, and tokenizes the name if it has
// one.
Accounts.onCreateUser((options, user) => {
  const profile = options.profile as Meteor.UserProfile | undefined
  return {
    ...user,
    ...(profile ? { profile } : {}),
    ...(typeof profile?.name === 'string'
      ? { nameTokens: nameTokens(profile.name) }
      : {}),
  }
})
