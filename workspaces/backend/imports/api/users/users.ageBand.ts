import { AGE_ANSWERS, type SetAgeBandArgs } from '@prezentowo/types'
import { Match, check } from 'meteor/check'
import { Meteor } from 'meteor/meteor'

import { deleteAccountFor, deleteCallersAccount } from './users.deleteAccount'

// The first-login age question (docs/spec.md §1.15, §2.2). A band is stored
// on the user's own document and is never changed by a later answer. Under
// 13 nothing is kept: the account goes, however it began.
const setAgeBand = async function (
  this: Meteor.MethodThisType,
  options: SetAgeBandArgs,
) {
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
  if (user.ageBand) return

  const { answer } = options
  if (answer === 'under-13') {
    // Someone who never finished first login owns nothing, and `requestMagicLink`
    // made their account: it only needs removing, with no chat to leave.
    const neverFinished = !user.profile?.name
    await deleteCallersAccount(
      this,
      neverFinished
        ? async id => void (await Meteor.users.removeAsync(id))
        : deleteAccountFor,
    )
    return
  }

  await Meteor.users.updateAsync(userId, { $set: { ageBand: answer } })
}

Meteor.methods({ 'users.setAgeBand': setAgeBand })
