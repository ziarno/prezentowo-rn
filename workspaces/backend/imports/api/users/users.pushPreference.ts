import { PUSH_KINDS, type SetPushPreferenceArgs } from '@prezentowo/types'
import { Match, check } from 'meteor/check'
import { Meteor } from 'meteor/meteor'

import { chatServer } from '../chat/chat.server'
import { upsertStreamUsers } from '../chat/chat.users'
import { mayHavePush } from '../push/push.tokens'

const setPushPreference = async function (
  this: Meteor.MethodThisType,
  args: SetPushPreferenceArgs,
) {
  check(args, { kind: Match.OneOf(...PUSH_KINDS), enabled: Boolean })
  if (!this.userId) {
    throw new Meteor.Error('notAuthorized', 'mustBeLoggedIn')
  }
  const { kind, enabled } = args
  // Under 16 has no push to set, and the chat write-through would switch
  // Stream's push on for them (docs/spec.md §10.5).
  if (!(await mayHavePush(this.userId))) return

  // Chat pushes are Stream's, so the switch is too. Stream can't be read
  // back, so Mongo holds the truth, written once Stream has taken it.
  const server = chatServer()
  if (kind === 'chat' && server) {
    await upsertStreamUsers(server, [this.userId])
    await server.setPushPreferences([
      { user_id: this.userId, chat_level: enabled ? 'all' : 'none' },
    ])
  }
  await Meteor.users.updateAsync(this.userId, {
    $set: { [`pushPreferences.${kind}`]: enabled },
  })
}

Meteor.methods({ 'users.setPushPreference': setPushPreference })
