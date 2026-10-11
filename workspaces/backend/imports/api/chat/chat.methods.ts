import type { StreamToken } from '@prezentowo/types'
import { Meteor } from 'meteor/meteor'

import { chatServer } from './chat.server'
import { upsertStreamUsers } from './chat.users'

// How long a token lives; the client SDK asks for a new one when it expires.
const TOKEN_TTL_SECONDS = 60 * 60

const streamToken = async function (
  this: Meteor.MethodThisType,
): Promise<StreamToken> {
  if (!this.userId) {
    throw new Meteor.Error('notAuthorized', 'mustBeLoggedIn')
  }
  const server = chatServer()
  if (!server) {
    throw new Meteor.Error('serverError', 'chatUnavailable')
  }

  // Chat shows the name the user has now.
  await upsertStreamUsers(server, [this.userId])

  // `iat` is what lets Stream revoke tokens issued before a given time.
  const iat = Math.floor(Date.now() / 1000)
  return {
    apiKey: server.apiKey,
    token: server.createToken(this.userId, iat + TOKEN_TTL_SECONDS, iat),
  }
}

Meteor.methods({
  'stream.token': streamToken,
})
