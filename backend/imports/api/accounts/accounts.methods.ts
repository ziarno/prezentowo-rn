import type { RegisterNewUserArgs, UpdateUserArgs } from '@prezentowo/types'
import { isEmpty } from 'lodash'
import { Accounts } from 'meteor/accounts-base'
import { Match, check } from 'meteor/check'
import { Meteor } from 'meteor/meteor'

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

  const userId = await Accounts.createUserAsync({
    email,
    password,
    profile: { name },
  })
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

  const currentEmail = user.emails?.[0]?.address
  const updates: Record<string, unknown> = {}

  if (name) {
    updates['profile.name'] = name
  }

  if (email && currentEmail !== email) {
    updates['emails'] = [{ address: email, verified: false }]
  }

  if (!isEmpty(updates)) {
    await Meteor.users.updateAsync(userId, { $set: updates })
  }
}

Meteor.methods({
  registerNewUser,
  updateUser,
})
