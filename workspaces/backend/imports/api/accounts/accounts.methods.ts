import type {
  RegisterNewUserArgs,
  RequestMagicLinkArgs,
  UpdateUserArgs,
} from '@prezentowo/types'
import { isEmpty } from 'lodash'
import { Accounts } from 'meteor/accounts-base'
import { Match, check } from 'meteor/check'
import { Meteor } from 'meteor/meteor'

import {
  asUpload,
  releaseImage,
  withUploadAttached,
} from '../images/images.refs'
import { nonEmptyString } from '../patterns'
import { nameFields } from '../users/users.nameTokens'

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
      avatar: Match.Maybe(String),
      photo: Match.Optional(Match.OneOf(nonEmptyString, null)),
    }),
  )

  if (!this.userId) {
    throw new Meteor.Error('notAuthorized', 'mustBeLoggedIn')
  }

  const { name, avatar, photo } = options
  const userId = this.userId

  const user = await Meteor.users.findOneAsync(userId)

  if (!user) {
    throw new Meteor.Error('notFound', 'userNotFound', userId)
  }

  const updates: Record<string, unknown> = {}

  if (name) {
    Object.assign(updates, nameFields(name))
  }

  if (avatar) {
    updates['profile.avatar'] = avatar
  }

  // null clears the photo, back to the stock avatar (docs/spec.md §1.10).
  const unset = photo === null ? { 'profile.photo': '' } : {}
  if (photo) {
    updates['profile.photo'] = photo
  }

  if (isEmpty(updates) && isEmpty(unset)) return

  const current = asUpload(user.profile?.photo)
  await withUploadAttached({ image: asUpload(photo), userId, current }, () =>
    Meteor.users.updateAsync(userId, {
      ...(isEmpty(updates) ? {} : { $set: updates }),
      ...(isEmpty(unset) ? {} : { $unset: unset }),
    }),
  )
  if (photo !== undefined) await releaseImage(current, asUpload(photo))
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
