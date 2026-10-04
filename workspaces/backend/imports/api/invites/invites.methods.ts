import { check } from 'meteor/check'
import { Meteor } from 'meteor/meteor'

import { Events } from '../events/events.collection'
import { isMemberOf, loadOwnEvent } from '../events/events.membership'
import {
  clearInviteDeferred,
  hasInvited,
  recordInviteDeferred,
} from '../notifications/notifications.records'
import { rotateInvite } from './invites.codes'
import { eventForCode } from './invites.lookup'

// `7a`'s Ignore: upserts the caller's `invite-deferred` notification. It never
// touches `Invites`, so the code keeps working for a later join. Someone
// already in the event has nothing to defer, and someone invited from `4d`
// keeps their `invited` as it is: there's no decline.
const ignoreInvite = async function (
  this: Meteor.MethodThisType,
  options: { code: string },
) {
  check(options, { code: String })

  if (!this.userId) {
    throw new Meteor.Error('notAuthorized', 'mustBeLoggedIn')
  }
  const event = await eventForCode(options.code)
  if (isMemberOf(event, this.userId)) return
  if (await hasInvited(this.userId, event._id)) return
  await recordInviteDeferred(this.userId, event._id)
  // A join may have landed between the check and the upsert; it would have
  // cleared nothing, so clear what we just wrote.
  const current = await Events.findOneAsync(event._id)
  if (current && isMemberOf(current, this.userId)) {
    await clearInviteDeferred(this.userId, event._id)
  }
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
