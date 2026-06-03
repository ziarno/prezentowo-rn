import type {
  RegisterNewUserArgs,
  RequestMagicLinkArgs,
  UpdateUserArgs,
} from '@prezentowo/types'
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

const updateUser = async function (
  this: Meteor.MethodThisType,
  options: UpdateUserArgs,
) {
  check(
    options,
    Match.ObjectIncluding({
      name: Match.Maybe(String),
      email: Match.Maybe(String),
      avatar: Match.Maybe(String),
    }),
  )

  if (!this.userId) {
    throw new Meteor.Error('notAuthorized', 'mustBeLoggedIn')
  }

  const { name, email, avatar } = options
  const userId = this.userId

  const user = await Meteor.users.findOneAsync(userId)

  if (!user) {
    throw new Meteor.Error('notFound', 'userNotFound', userId)
  }

  const currentEmail = user.emails?.[0]?.address
  const updates: Record<string, unknown> = {}

  if (name) {
    updates['profile.name'] = name
  }

  if (avatar) {
    updates['profile.avatar'] = avatar
  }

  if (email && currentEmail !== email) {
    updates['emails'] = [{ address: email, verified: false }]
  }

  if (!isEmpty(updates)) {
    await Meteor.users.updateAsync(userId, { $set: updates })
  }
}

const requestMagicLink = async function (options: RequestMagicLinkArgs) {
  check(options, Match.ObjectIncluding({ email: String }))

  const normalized = options.email.trim().toLowerCase()

  // Pre-create the user if absent so first-time visitors get a magic link
  // without needing client-side createUser (which `forbidClientAccountCreation`
  // blocks for the accounts-password path).
  if (!(await Accounts.findUserByEmail(normalized))) {
    await Accounts.createUserAsync({ email: normalized })
  }

  // accounts-passwordless registers `requestLoginTokenForUser` as a Meteor
  // method; we invoke it server-side to issue + email a token.
  await Meteor.callAsync('requestLoginTokenForUser', {
    selector: { email: normalized },
    userData: { email: normalized },
    options: { userCreationDisabled: true },
  })
}

Meteor.methods({
  registerNewUser,
  updateUser,
  requestMagicLink,
})
