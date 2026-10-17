import {
  PUSH_AGE,
  type UserSearchArgs,
  type UserSearchResult,
  isSearchableQuery,
  latestBirthDateAtAge,
  nameTokens,
} from '@prezentowo/types'
import { escapeRegExp } from 'lodash'
import { Match, check } from 'meteor/check'
import { DDPRateLimiter } from 'meteor/ddp-rate-limiter'
import { Meteor } from 'meteor/meteor'
import type { Mongo } from 'meteor/mongo'

import { today } from '../today'

const MAX_RESULTS = 10
// Longer than any name; bounds how many regexes one call can ask for.
const MAX_QUERY_LENGTH = 100

// The users `users.search` may return for `tokens`, as of `day`: not the
// caller, with a name, 16 or over on `day` (`birthDate` no later than `day`
// minus 16 years; ISO strings compare as dates, and no date never matches)
// and with a `nameTokens` word starting with each token. Anchored regexes
// and the range share the `nameTokens, birthDate` index (docs/spec.md §1.15).
export const searchSelector = (userId: string, tokens: string[], day: string) =>
  ({
    _id: { $ne: userId },
    birthDate: { $lte: latestBirthDateAtAge(PUSH_AGE, day) },
    'profile.name': { $type: 'string', $ne: '' },
    $and: tokens.map(token => ({
      nameTokens: { $regex: `^${escapeRegExp(token)}` },
    })),
  }) as Mongo.Selector<Meteor.User>

// `4d`'s people search: any user 16 or over today with a name whose words start with every word
// of the query, found by name and returned by name and avatar only — never
// an email. Online-only; the client never queues or caches it.
const searchUsers = async function (
  this: Meteor.MethodThisType,
  options: UserSearchArgs,
): Promise<UserSearchResult[]> {
  check(options, {
    query: Match.Where(
      (query: unknown): query is string =>
        typeof query === 'string' && query.length <= MAX_QUERY_LENGTH,
    ),
  })

  if (!this.userId) {
    throw new Meteor.Error('notAuthorized', 'mustBeLoggedIn')
  }

  if (!isSearchableQuery(options.query)) return []
  const tokens = nameTokens(options.query)

  // Under 16 and users who have not answered yet are never found (§1.15).
  const users = await Meteor.users
    .find(searchSelector(this.userId, tokens, today()), {
      fields: { 'profile.name': 1, 'profile.avatar': 1, 'profile.photo': 1 },
      sort: { 'profile.name': 1 },
      limit: MAX_RESULTS,
    })
    .fetchAsync()

  return users.map(user => ({
    userId: user._id,
    name: user.profile?.name ?? '',
    ...(user.profile?.avatar ? { avatar: user.profile.avatar } : {}),
    ...(user.profile?.photo ? { photo: user.profile.photo } : {}),
  }))
}

Meteor.methods({ 'users.search': searchUsers })

// Typing in `4d` searches every 300 ms at most; this stops anyone walking
// the user list faster than that.
DDPRateLimiter.addRule(
  {
    type: 'method',
    name: 'users.search',
    userId: () => true,
    connectionId: () => true,
  },
  10,
  10_000,
)
