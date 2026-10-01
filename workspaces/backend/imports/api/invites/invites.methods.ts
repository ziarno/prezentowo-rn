import { check } from 'meteor/check'
import { Meteor } from 'meteor/meteor'

import { loadOwnEvent } from '../events/events.membership'
import { rotateInvite } from './invites.codes'
import { eventForCode } from './invites.lookup'

// `7a`'s Ignore. It will upsert the caller's `invite-deferred` notification
// once notifications exist; until then it only checks the code. It never
// touches `Invites`, so the code keeps working for a later join.
const ignoreInvite = async function (
  this: Meteor.MethodThisType,
  options: { code: string },
) {
  check(options, { code: String })

  if (!this.userId) {
    throw new Meteor.Error('notAuthorized', 'mustBeLoggedIn')
  }
  await eventForCode(options.code)
}

// `6a`'s Rotate link: the event keeps its one invite, under a new code.
const rotate = async function (
  this: Meteor.MethodThisType,
  options: { eventId: string },
) {
  check(options, { eventId: String })

  if (!this.userId) {
    throw new Meteor.Error('notAuthorized', 'mustBeLoggedIn')
  }
  await loadOwnEvent(options.eventId, this.userId)
  await rotateInvite(options.eventId)
}

Meteor.methods({
  'invites.ignore': ignoreInvite,
  'invites.rotate': rotate,
})
