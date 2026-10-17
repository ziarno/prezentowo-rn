import type {
  DeleteAccountArgs,
  EventDoc,
  EventParticipant,
} from '@prezentowo/types'
import { Accounts } from 'meteor/accounts-base'
import { check } from 'meteor/check'
import { Meteor } from 'meteor/meteor'

import { ChatThreads } from '../chat/chat.collection'
import { chatServer } from '../chat/chat.server'
import { syncChatThreads } from '../chat/chat.sync'
import { cascadeEventDeletion } from '../events/events.cascade'
import { Events } from '../events/events.collection'
import { Gifts } from '../gifts/gifts.collection'
import { asUpload, releaseImage } from '../images/images.refs'
import { Invites } from '../invites/invites.collection'
import { Notifications } from '../notifications/notifications.collection'
import { recordEventHandedOver } from '../notifications/notifications.records'
import { removePushTokensOf } from '../push/push.tokens'

// The brand's berry, amber and green, as on the app's placeholder swatches.
const DEPARTED_COLORS = ['#9a3a25', '#c7973d', '#2f5b3a'] as const

// A colour that depends on the participant id alone, so a departed
// placeholder keeps its colour whenever it's read.
export const departedColor = (participantId: string) => {
  let hash = 0
  for (const char of participantId) hash = (hash * 31 + char.charCodeAt(0)) | 0
  return DEPARTED_COLORS[Math.abs(hash) % DEPARTED_COLORS.length]!
}

// The earliest-joined real participant other than `userId`, who inherits an
// event they created: `participants` is in the order of joining.
const heirOf = (event: EventDoc, userId: string) =>
  event.participants.find(
    (p): p is Extract<EventParticipant, { kind: 'real' }> =>
      p.kind === 'real' && p.userId !== userId,
  )

// Step 1: events `userId` created that another real participant is in go to
// the earliest-joined of them. The writes run so that each can be repeated:
// the event, which selects them, moves last.
async function handOverEvents(userId: string, events: EventDoc[]) {
  for (const event of events) {
    const heir = heirOf(event, userId)
    if (!heir) continue
    await Invites.updateAsync(
      { eventId: event._id },
      { $set: { ownerId: heir.userId } },
    )
    await recordEventHandedOver(heir.userId, event._id)
    await Events.updateAsync(
      { _id: event._id, ownerId: userId },
      { $set: { ownerId: heir.userId } },
    )
  }
}

// Step 2: events with nobody else real are deleted, with `events.delete`'s
// cascade. The cascade runs before the event goes, so a run that dies in
// between still finds the event, and its cascade, next time.
async function deleteAloneEvents(events: EventDoc[]) {
  for (const event of events) {
    await cascadeEventDeletion(event)
    await Events.removeAsync(event._id)
  }
}

// Step 4: `userId`'s participant entry in every event becomes a departed
// placeholder (docs/spec.md §1.12), under the same id.
async function departParticipants(
  userId: string,
  profile: { name: string; avatar?: string },
) {
  const events = await Events.find({
    participants: { $elemMatch: { kind: 'real', userId } },
  }).fetchAsync()
  for (const event of events) {
    const mine = event.participants.find(
      p => p.kind === 'real' && p.userId === userId,
    )!
    const departed: EventParticipant = {
      id: mine.id,
      kind: 'placeholder',
      name: profile.name,
      color: departedColor(mine.id),
      ...(profile.avatar ? { avatar: profile.avatar } : {}),
      departedUserId: userId,
    }
    await Events.updateAsync(
      // Only while the entry is still theirs; the selector typings don't
      // model $elemMatch on an array of a union.
      {
        _id: event._id,
        participants: { $elemMatch: { id: mine.id, kind: 'real', userId } },
      } as never,
      { $set: { 'participants.$': departed } },
    )
  }
}

// Step 5: takes `userId` out of chat. `syncChatThreads` retires the secret
// threads about them and removes them from the rest, but swallows a Stream
// failure, so the result is checked: the account stays until Stream agrees,
// and the call can be run again.
async function leaveChat(userId: string) {
  const events = await Events.find(
    { 'participants.departedUserId': userId },
    { fields: { _id: 1 } },
  ).fetchAsync()
  for (const { _id } of events) await syncChatThreads(_id)

  const server = chatServer()
  if (!server) return
  const stillIn = await ChatThreads.findOneAsync({
    memberIds: userId,
    retiredAt: { $exists: false },
  })
  if (stillIn) throw new Meteor.Error('serverError', 'chatNotSynced')
  // The user is anonymised, never deleted, so their messages stay.
  await server.anonymiseUser(userId)
}

/**
 * Deletes the account `userId` (docs/spec.md §10.4): what other people share
 * with them stays, as a departed placeholder where they were, and what is
 * theirs alone goes. Every step is idempotent and the user document goes
 * last, so a call that dies half-way is simply run again. Does nothing for an
 * account that's gone.
 */
export async function deleteAccountFor(userId: string): Promise<void> {
  const user = await Meteor.users.findOneAsync(userId)
  if (!user) return
  const profile = {
    name: user.profile?.name ?? '',
    avatar: user.profile?.avatar,
  }

  // 1. + 2. Events you created.
  const created = await Events.find({ ownerId: userId }).fetchAsync()
  const hasHeir = (event: EventDoc) => !!heirOf(event, userId)
  await handOverEvents(userId, created.filter(hasHeir))
  await deleteAloneEvents(created.filter(event => !hasHeir(event)))

  // 3. Your claims, pulled silently.
  await Gifts.updateAsync(
    { claimedBy: userId },
    { $pull: { claimedBy: userId } },
    { multi: true },
  )

  // 4. Your place in every remaining event.
  await departParticipants(userId, profile)

  // 5. Chat.
  await leaveChat(userId)

  // 6. Reservations for you: an ordinary placeholder keeps the name.
  await Events.updateAsync(
    { 'participants.invitedUserId': userId },
    { $unset: { 'participants.$.invitedUserId': '' } },
    { multi: true },
  )

  // 7. Your notifications.
  await Notifications.removeAsync({ userId })

  // 8. Your push tokens, each after its Stream device.
  await removePushTokensOf(userId)

  // 9. Your profile photo, upload and `Images` record.
  await releaseImage(asUpload(user.profile?.photo))

  // 10. The user document, last. Meteor closes the connections logged in as
  // you.
  await Meteor.users.removeAsync(userId)
}

// accounts-base 3.3.1 has these; @types/meteor doesn't declare them. Tokens
// are hashed.
type AccountsInternals = {
  _getLoginToken: (connectionId: string) => string | null
  _setLoginToken: (
    userId: string,
    connection: Meteor.Connection,
    hashedToken: string | null,
  ) => void
}

/**
 * Deletes the account of the method's caller (`this.userId`) and ends the
 * caller's session, for the methods that delete the account they were called
 * from. `deleter` is what removes the account, `deleteAccountFor` unless the
 * caller knows a lighter removal does.
 */
export async function deleteCallersAccount(
  method: Meteor.MethodThisType,
  deleter: (userId: string) => Promise<void> = deleteAccountFor,
): Promise<void> {
  const userId = method.userId!
  // Removing the user closes every connection logged in as them, this one
  // too, possibly before the answer is sent; the client would then resend
  // the call signed out. So detach this connection from its login token
  // first, as `logout` does, and only the account's other connections close.
  // A run that fails part-way reattaches it, so the user can retry.
  const connection = method.connection
  const accounts = Accounts as unknown as AccountsInternals
  const token = connection ? accounts._getLoginToken(connection.id) : null
  if (connection) accounts._setLoginToken(userId, connection, null)
  try {
    await deleter(userId)
  } catch (error) {
    if (connection) accounts._setLoginToken(userId, connection, token)
    throw error
  }
  if (connection) await method.setUserId(null)
}

const deleteAccount = async function (
  this: Meteor.MethodThisType,
  options: DeleteAccountArgs,
) {
  check(options, { email: String })

  if (!this.userId) {
    throw new Meteor.Error('notAuthorized', 'mustBeLoggedIn')
  }
  const userId = this.userId

  const user = await Meteor.users.findOneAsync(userId, {
    fields: { emails: 1 },
  })
  if (!user) {
    throw new Meteor.Error('notFound', 'userNotFound', userId)
  }
  // The retyped address is the deliberate-action check (§2.2).
  const typed = options.email.trim().toLowerCase()
  const matches =
    typed !== '' &&
    (user.emails ?? []).some(e => e.address.trim().toLowerCase() === typed)
  if (!matches) {
    throw new Meteor.Error('notAuthorized', 'emailMismatch')
  }

  await deleteCallersAccount(this)
}

Meteor.methods({ 'users.deleteAccount': deleteAccount })
