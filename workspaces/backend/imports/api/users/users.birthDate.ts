import {
  PUSH_AGE,
  type SetBirthDateArgs,
  type SetBirthDateResult,
  ageOn,
  birthDateProblem,
  isUnder13,
} from '@prezentowo/types'
import { check } from 'meteor/check'
import { Meteor } from 'meteor/meteor'

import { removePushTokensOf } from '../push/push.tokens'
import { today } from '../today'
import { deleteAccountFor, deleteCallersAccount } from './users.deleteAccount'

const removeUnfinishedAccount = async (userId: string) => {
  await Meteor.users.removeAsync(userId)
}

// The first-login date of birth (docs/spec.md §1.15, §2.2). The full date is
// stored on the user's own document and is never changed by a later answer.
// It is only validated: a real day, not in the future, not over 120 years
// back; there is no confirmation or ID check. Under 13 nothing is kept: the
// account goes, however it began, and a retry is not blocked. Answers whether
// it went, so the app shows the stop message only when it did.
const setBirthDate = async function (
  this: Meteor.MethodThisType,
  options: SetBirthDateArgs,
): Promise<SetBirthDateResult> {
  check(options, { birthDate: String })

  if (!this.userId) {
    throw new Meteor.Error('notAuthorized', 'mustBeLoggedIn')
  }
  const userId = this.userId
  const { birthDate } = options
  const day = today()

  const problem = birthDateProblem(birthDate, day)
  if (problem) throw new Meteor.Error('invalidBirthDate', problem)

  const user = await Meteor.users.findOneAsync(userId, {
    fields: { birthDate: 1, 'profile.name': 1 },
  })
  if (!user) {
    throw new Meteor.Error('notFound', 'userNotFound', userId)
  }
  if (user.birthDate) return { deleted: false }

  if (isUnder13(birthDate, day)) {
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
  // before the date is stored, so a Stream failure leaves the question open
  // to answer again.
  if (ageOn(birthDate, day) < PUSH_AGE) await removePushTokensOf(userId)
  await Meteor.users.updateAsync(userId, { $set: { birthDate } })
  return { deleted: false }
}

Meteor.methods({ 'users.setBirthDate': setBirthDate })
