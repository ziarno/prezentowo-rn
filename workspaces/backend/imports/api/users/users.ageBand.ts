import {
  AGE_ANSWERS,
  type SetAgeBandArgs,
  type SetAgeBandResult,
  THIRTEEN_TO_FIFTEEN,
  UNDER_13,
} from '@prezentowo/types'
import { Match, check } from 'meteor/check'
import { Meteor } from 'meteor/meteor'

import { removePushTokensOf } from '../push/push.tokens'
import { deleteAccountFor, deleteCallersAccount } from './users.deleteAccount'

const removeUnfinishedAccount = async (userId: string) => {
  await Meteor.users.removeAsync(userId)
}

// The first-login age question (docs/spec.md §1.15, §2.2). A band is stored
// on the user's own document and is never changed by a later answer. Under
// 13 nothing is kept: the account goes, however it began. Answers whether it
// went, so the app shows the stop message only when it did.
const setAgeBand = async function (
  this: Meteor.MethodThisType,
  options: SetAgeBandArgs,
): Promise<SetAgeBandResult> {
  check(options, { answer: Match.OneOf(...AGE_ANSWERS) })

  if (!this.userId) {
    throw new Meteor.Error('notAuthorized', 'mustBeLoggedIn')
  }
  const userId = this.userId

  const user = await Meteor.users.findOneAsync(userId, {
    fields: { ageBand: 1, 'profile.name': 1 },
  })
  if (!user) {
    throw new Meteor.Error('notFound', 'userNotFound', userId)
  }
  if (user.ageBand) return { deleted: false }

  const { answer } = options
  if (answer === UNDER_13) {
    // Someone who never finished first login (no name yet) owns nothing, and
    // `requestMagicLink` made their account: it only needs removing, with no
    // chat to leave. An account from before the question has a name, and goes
    // with everything it has.
    const neverFinishedFirstLogin = !user.profile?.name
    await deleteCallersAccount(
      this,
      neverFinishedFirstLogin ? removeUnfinishedAccount : deleteAccountFor,
    )
    return { deleted: true }
  }

  // An account from before the question may hold devices, here and in
  // Stream, whose chat push would go on: under 16 has none (§10.5). They go
  // before the band is stored, so a Stream failure leaves the question open
  // to answer again.
  if (answer === THIRTEEN_TO_FIFTEEN) await removePushTokensOf(userId)
  await Meteor.users.updateAsync(userId, { $set: { ageBand: answer } })
  return { deleted: false }
}

Meteor.methods({ 'users.setAgeBand': setAgeBand })
