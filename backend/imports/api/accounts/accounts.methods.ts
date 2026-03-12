import { Accounts } from 'meteor/accounts-base'
import { Match, check } from 'meteor/check'
import { Meteor } from 'meteor/meteor'

import type { RegisterNewUserArgs, UpdateUserArgs } from '@prezentowo/types'

const registerNewUser = async function (options: RegisterNewUserArgs) {
  check(
    options,
    Match.ObjectIncluding({
      email: String,
      password: String,
      name: String,
    }),
  )

  const { email, password, name } = options

  if (await Accounts.findUserByEmail(email)) {
    throw new Meteor.Error('permissionDenied', 'userExists', email)
  }

  const userId = Accounts.createUser({ email, password, profile: { name } })
  const stampedToken = Accounts._generateStampedLoginToken()
  const hashedToken = Accounts._hashStampedToken(stampedToken)
  Accounts._insertHashedLoginToken(userId, hashedToken)

  return { id: userId, token: stampedToken.token }
}

const updateUser = async function (options: UpdateUserArgs) {
  check(
    options,
    Match.ObjectIncluding({
      userId: String,
      name: Match.Maybe(String),
      email: Match.Maybe(String),
    }),
  )

  const { userId, name, email } = options

  const user = await Meteor.users.findOneAsync(userId)

  if (!user) {
    throw new Meteor.Error('notFound', 'userNotFound', userId)
  }

  if (name) {
    Meteor.users.update(userId, { $set: { 'profile.name': name } })
  }

  if (email) {
    Accounts.removeEmail(userId, user.emails![0].address)
    Accounts.addEmail(userId, email)
  }
}

Meteor.methods({
  registerNewUser,
  updateUser,
})
