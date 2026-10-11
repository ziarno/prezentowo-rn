import {
  BACKGROUND_ILLUSTRATION_IDS,
  type CreateEventArgs,
  type EventDoc,
  type EventKind,
  type EventParticipant,
  type EventParticipantInput,
  type JoinEventArgs,
  type JoinEventResult,
  type RemoveParticipantArgs,
  type UpdateEventArgs,
  type UpdateParticipantArgs,
} from '@prezentowo/types'
import { isEmpty } from 'lodash'
import { Match, check } from 'meteor/check'
import { Meteor } from 'meteor/meteor'
import type { Mongo } from 'meteor/mongo'
import { Random } from 'meteor/random'

import { recordParticipantJoined } from '../activity/activity.records'
import { syncChatThreads } from '../chat/chat.sync'
import { Gifts } from '../gifts/gifts.collection'
import { imageRefPattern } from '../images/images.patterns'
import {
  asUpload,
  assertStockArt,
  releaseImage,
  withUploadAttached,
  withUploadsAttached,
} from '../images/images.refs'
import { insertInvite } from '../invites/invites.codes'
import { eventForCode } from '../invites/invites.lookup'
import {
  clearInvitesTo,
  recordParticipantJoined as notifyParticipantJoined,
  recordInvited,
} from '../notifications/notifications.records'
import { nonEmptyString } from '../patterns'
import {
  cascadeEventDeletion,
  cascadeParticipantRemoval,
} from './events.cascade'
import { Events } from './events.collection'
import { loadOwnEvent } from './events.membership'

const participantPattern = Match.Where(
  (value: unknown): value is EventParticipantInput => {
    if (value === null || typeof value !== 'object') return false
    const p = value as { kind?: unknown }
    if (p.kind === 'real') {
      check(value, Match.ObjectIncluding({ kind: String, userId: String }))
      return true
    }
    if (p.kind === 'invited') {
      check(
        value,
        Match.ObjectIncluding({ kind: String, userId: String, color: String }),
      )
      return true
    }
    if (p.kind === 'placeholder') {
      check(
        value,
        Match.ObjectIncluding({
          kind: String,
          name: String,
          color: String,
          avatar: Match.Maybe(String),
          photo: Match.Optional(nonEmptyString),
        }),
      )
      return true
    }
    return false
  },
)

// A real calendar day as `YYYY-MM-DD`; the date drives the Home countdown.
const isCalendarDate = (date: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false
  const parsed = new Date(`${date}T00:00:00Z`)
  return !isNaN(parsed.getTime()) && parsed.toISOString().startsWith(date)
}

/**
 * The profiles of the users `participants` invites, by userId, for their
 * reserved placeholders. Only the caller can be a `real` entry: anyone else
 * is invited, and joins only by accepting.
 */
async function loadInvitees(
  participants: EventParticipantInput[],
  userId: string,
): Promise<Map<string, { name: string; avatar?: string }>> {
  const invitees = new Map<string, { name: string; avatar?: string }>()
  for (const p of participants) {
    if (p.kind === 'real' && p.userId !== userId) {
      throw new Meteor.Error('notAuthorized', 'cannotAddOthers')
    }
    if (p.kind !== 'invited') continue
    if (p.userId === userId) {
      throw new Meteor.Error('invalidArgs', 'cannotInviteYourself')
    }
    if (invitees.has(p.userId)) {
      throw new Meteor.Error('invalidArgs', 'duplicateInvitee')
    }
    const user = await Meteor.users.findOneAsync(p.userId, {
      fields: { 'profile.name': 1, 'profile.avatar': 1 },
    })
    const { name, avatar } = user?.profile ?? {}
    // Someone without a name can't be found, so can't be invited either.
    if (!name?.trim()) throw new Meteor.Error('notFound', 'userNotFound')
    invitees.set(p.userId, { name: name.trim(), ...(avatar ? { avatar } : {}) })
  }
  return invitees
}

// The stored kind, with `beneficiaryIndex` resolved to the minted id of the
// participant it points at.
const resolveKind = (
  options: CreateEventArgs,
  participantIds: string[],
): EventKind => {
  if (options.type === 'many-to-many') return { type: 'many-to-many' }
  if (options.type !== 'many-to-one') {
    throw new Meteor.Error('invalidArgs', 'invalidKind')
  }
  const index: unknown = options.beneficiaryIndex
  if (
    typeof index !== 'number' ||
    !Number.isInteger(index) ||
    index < 0 ||
    index >= participantIds.length
  ) {
    throw new Meteor.Error('invalidArgs', 'invalidBeneficiary')
  }
  return {
    type: 'many-to-one',
    beneficiaryParticipantId: participantIds[index]!,
  }
}

const createEvent = async function (
  this: Meteor.MethodThisType,
  options: CreateEventArgs,
) {
  check(
    options,
    Match.ObjectIncluding({
      title: String,
      date: String,
      background: Match.Optional(imageRefPattern),
      participants: [participantPattern],
      // Validated by resolveKind, which names the error.
      type: Match.Any,
    }),
  )

  if (!this.userId) {
    throw new Meteor.Error('notAuthorized', 'mustBeLoggedIn')
  }
  const userId = this.userId

  const title = options.title.trim()
  const date = options.date.trim()

  if (!title || !date) {
    throw new Meteor.Error('invalidArgs', 'missingFields')
  }
  if (!isCalendarDate(date)) {
    throw new Meteor.Error('invalidArgs', 'invalidDate')
  }
  assertStockArt(options.background, BACKGROUND_ILLUSTRATION_IDS)

  const host: EventParticipant = { id: Random.id(), kind: 'real', userId }
  const invitees = await loadInvitees(options.participants, userId)

  // Mint an id per input entry, in order, so `beneficiaryIndex` can be
  // resolved. The host is always the caller: any `real` entry for them maps
  // to the one host participant, which is prepended exactly once.
  const minted = options.participants.map((p): EventParticipant => {
    if (p.kind === 'real') return host
    if (p.kind === 'invited') {
      const profile = invitees.get(p.userId)!
      return {
        id: Random.id(),
        kind: 'placeholder',
        name: profile.name,
        color: p.color,
        ...(profile.avatar ? { avatar: profile.avatar } : {}),
        invitedUserId: p.userId,
      }
    }
    return {
      id: Random.id(),
      kind: 'placeholder',
      name: p.name.trim(),
      color: p.color,
      ...(p.avatar ? { avatar: p.avatar } : {}),
      ...(p.photo ? { photo: p.photo } : {}),
    }
  })
  const kind = resolveKind(
    options,
    minted.map(p => p.id),
  )

  // The placeholders' photos, attached with the background (§1.11).
  const photos = options.participants.map(p =>
    p.kind === 'placeholder' ? asUpload(p.photo) : undefined,
  )
  const _id = await withUploadsAttached(
    { images: [options.background, ...photos], userId },
    async () => {
      const eventId = await Events.insertAsync({
        title,
        date,
        ...(options.background ? { background: options.background } : {}),
        ownerId: userId,
        participants: [host, ...minted.filter(p => p !== host)],
        createdAt: new Date(),
        ...kind,
      } as Parameters<typeof Events.insertAsync>[0])

      // An event is never left without its invite.
      try {
        await insertInvite(eventId, userId)
      } catch (error) {
        await Events.removeAsync(eventId)
        throw error
      }
      return eventId
    },
  )
  for (const invitee of invitees.keys()) await recordInvited(invitee, _id)
  await syncChatThreads(_id)

  return { _id }
}

// A sent kind, checked against the event's own participants.
const validKind = (kind: unknown, event: EventDoc): EventKind => {
  const { type, beneficiaryParticipantId } = (kind ?? {}) as {
    type?: unknown
    beneficiaryParticipantId?: unknown
  }
  if (type === 'many-to-many') return { type }
  if (type !== 'many-to-one') {
    throw new Meteor.Error('invalidArgs', 'invalidKind')
  }
  if (!event.participants.some(p => p.id === beneficiaryParticipantId)) {
    throw new Meteor.Error('invalidArgs', 'invalidBeneficiary')
  }
  return { type, beneficiaryParticipantId: beneficiaryParticipantId as string }
}

const updateEvent = async function (
  this: Meteor.MethodThisType,
  options: UpdateEventArgs,
) {
  check(
    options,
    Match.ObjectIncluding({
      eventId: String,
      title: Match.Optional(String),
      date: Match.Optional(String),
      background: Match.Optional(Match.OneOf(null, imageRefPattern)),
      // Validated by validKind, which names the error.
      kind: Match.Optional(Match.Any),
    }),
  )

  if (!this.userId) {
    throw new Meteor.Error('notAuthorized', 'mustBeLoggedIn')
  }
  const userId = this.userId

  const event = await loadOwnEvent(options.eventId, userId)

  const $set: Record<string, unknown> = {}
  const $unset: Record<string, ''> = {}

  if (options.title !== undefined) {
    const title = options.title.trim()
    if (!title) throw new Meteor.Error('invalidArgs', 'missingFields')
    $set.title = title
  }
  if (options.date !== undefined) {
    const date = options.date.trim()
    if (!isCalendarDate(date)) {
      throw new Meteor.Error('invalidArgs', 'invalidDate')
    }
    $set.date = date
  }
  assertStockArt(options.background, BACKGROUND_ILLUSTRATION_IDS)
  if (options.background) $set.background = options.background
  if (options.background === null) $unset.background = ''

  if (options.kind !== undefined) {
    const kind = validKind(options.kind, event)
    // Presents are given to someone, so who they're for can't move under
    // them (docs/spec.md §2.2).
    if (
      await Gifts.findOneAsync({ eventId: event._id }, { fields: { _id: 1 } })
    ) {
      throw new Meteor.Error('invalidArgs', 'kindLocked')
    }
    Object.assign($set, kind)
    if (kind.type === 'many-to-many') $unset.beneficiaryParticipantId = ''
  }

  const modifier = {
    ...(Object.keys($set).length > 0 ? { $set } : {}),
    ...(Object.keys($unset).length > 0 ? { $unset } : {}),
  }
  if (Object.keys(modifier).length > 0) {
    await withUploadAttached(
      { image: options.background, userId, current: event.background },
      () => Events.updateAsync(event._id, modifier),
    )
  }
  if (options.background !== undefined) {
    await releaseImage(event.background, options.background)
  }
  // A beneficiary change retires and replaces secret threads.
  if (options.kind !== undefined) await syncChatThreads(event._id)
}

// The placeholder whose picture the creator may set: one added by name. A
// reserved placeholder shows its invitee's picture (docs/spec.md §1.11).
const editablePlaceholder = (event: EventDoc, participantId: string) => {
  const participant = event.participants.find(p => p.id === participantId)
  if (!participant) {
    throw new Meteor.Error('notFound', 'participantNotFound')
  }
  if (participant.kind !== 'placeholder') {
    throw new Meteor.Error('notAuthorized', 'mustBeAPlaceholder')
  }
  if (participant.invitedUserId) {
    throw new Meteor.Error('notAuthorized', 'placeholderReserved')
  }
  return participant
}

const updateParticipant = async function (
  this: Meteor.MethodThisType,
  options: UpdateParticipantArgs,
) {
  check(options, {
    eventId: String,
    participantId: String,
    avatar: Match.Optional(nonEmptyString),
    photo: Match.Optional(Match.OneOf(nonEmptyString, null)),
  })

  if (!this.userId) {
    throw new Meteor.Error('notAuthorized', 'mustBeLoggedIn')
  }
  const userId = this.userId
  const { avatar, photo } = options

  const event = await loadOwnEvent(options.eventId, userId)
  const placeholder = editablePlaceholder(event, options.participantId)

  const $set: Record<string, string> = {}
  const $unset: Record<string, ''> = {}
  if (avatar) $set['participants.$.avatar'] = avatar
  if (photo) $set['participants.$.photo'] = photo
  if (photo === null) $unset['participants.$.photo'] = ''
  if (isEmpty($set) && isEmpty($unset)) return

  // Lands only on the placeholder as read: still unclaimed, unreserved and
  // holding the photo this call replaces, so a dropped upload is never left
  // attached.
  const unchangedSinceRead = {
    _id: event._id,
    participants: {
      $elemMatch: {
        id: placeholder.id,
        kind: 'placeholder',
        invitedUserId: { $exists: false },
        photo: placeholder.photo ?? { $exists: false },
      },
    },
  } as unknown as Mongo.Selector<EventDoc>
  const current = asUpload(placeholder.photo)
  await withUploadAttached(
    { image: asUpload(photo), userId, current },
    async () => {
      const updated = await Events.updateAsync(unchangedSinceRead, {
        ...(isEmpty($set) ? {} : { $set }),
        ...(isEmpty($unset) ? {} : { $unset }),
      })
      if (!updated) {
        // Throws whichever reason now applies.
        editablePlaceholder(
          await loadOwnEvent(options.eventId, userId),
          options.participantId,
        )
        throw new Meteor.Error('serverError', 'concurrentChange')
      }
    },
  )
  if (photo !== undefined) await releaseImage(current, asUpload(photo))
}

/**
 * The placeholder a join by `userId` claims, if any: their own reservation
 * whatever `participantId` says, else the placeholder `participantId` names.
 * Someone else's reservation answers like a missing placeholder, so a join
 * never confirms one is there.
 */
function claimTarget(
  event: EventDoc,
  userId: string,
  participantId: string | undefined,
): EventParticipant | undefined {
  const reserved = event.participants.find(
    p => p.kind === 'placeholder' && p.invitedUserId === userId,
  )
  if (reserved) return reserved
  if (!participantId) return undefined

  const target = event.participants.find(p => p.id === participantId)
  // Someone else's reservation and a departed placeholder (§1.12) are
  // nobody's to claim, and answer like a missing one.
  if (
    !target ||
    (target.kind === 'placeholder' &&
      (target.invitedUserId || target.departedUserId))
  ) {
    throw new Meteor.Error('notFound', 'placeholderNotFound')
  }
  if (target.kind !== 'placeholder') {
    throw new Meteor.Error('invalidArgs', 'mustBeAPlaceholder')
  }
  return target
}

// Another join may rewrite the participant list between our read and write,
// so the write only lands on the list it was computed from; otherwise it's
// recomputed from a fresh read, a few times at most.
const MAX_JOIN_ATTEMPTS = 3

const joinEvent = async function (
  this: Meteor.MethodThisType,
  options: JoinEventArgs,
): Promise<JoinEventResult> {
  check(
    options,
    Match.ObjectIncluding({
      code: String,
      participantId: Match.Optional(String),
    }),
  )

  if (!this.userId) {
    throw new Meteor.Error('notAuthorized', 'mustBeLoggedIn')
  }
  const userId = this.userId

  for (let attempt = 0; attempt < MAX_JOIN_ATTEMPTS; attempt++) {
    const event = await eventForCode(options.code)

    if (
      event.participants.some(p => p.kind === 'real' && p.userId === userId)
    ) {
      throw new Meteor.Error('alreadyJoined', 'alreadyAParticipant')
    }

    let joinedAsParticipantId: string
    let nextParticipants: EventParticipant[]
    const target = claimTarget(event, userId, options.participantId)
    if (target) {
      // The placeholder's id is kept, so gifts already on their list stay.
      // A reservation's `invitedUserId` goes with the rest of it.
      joinedAsParticipantId = target.id
      nextParticipants = event.participants.map(p =>
        p.id === target.id ? { id: p.id, kind: 'real', userId } : p,
      )
    } else {
      joinedAsParticipantId = Random.id()
      nextParticipants = [
        ...event.participants,
        { id: joinedAsParticipantId, kind: 'real', userId },
      ]
    }

    // Compare-and-set on the whole array, which the selector typings don't
    // model.
    const participantsAsRead = {
      _id: event._id,
      participants: event.participants,
    } as unknown as Mongo.Selector<EventDoc>
    const updated = await Events.updateAsync(participantsAsRead, {
      $set: { participants: nextParticipants },
    })
    if (updated) {
      // The claimant shows their own picture from now on (§1.11).
      if (target?.kind === 'placeholder') {
        await releaseImage(asUpload(target.photo))
      }
      await recordParticipantJoined(event._id, joinedAsParticipantId)
      await notifyParticipantJoined(event, joinedAsParticipantId)
      await clearInvitesTo(userId, event._id)
      await syncChatThreads(event._id)
      return { eventId: event._id }
    }
  }
  throw new Meteor.Error('serverError', 'concurrentJoin')
}

// The participant `6a` may remove: anyone but the creator and the current
// beneficiary, whose presents are the point of the event.
const assertRemovable = (
  event: EventDoc,
  participantId: string,
): EventParticipant => {
  const participant = event.participants.find(p => p.id === participantId)
  if (!participant) {
    throw new Meteor.Error('notFound', 'participantNotFound')
  }
  if (participant.kind === 'real' && participant.userId === event.ownerId) {
    throw new Meteor.Error('invalidArgs', 'cannotRemoveCreator')
  }
  if (
    event.type === 'many-to-one' &&
    event.beneficiaryParticipantId === participantId
  ) {
    throw new Meteor.Error('invalidArgs', 'cannotRemoveBeneficiary')
  }
  return participant
}

const removeParticipant = async function (
  this: Meteor.MethodThisType,
  options: RemoveParticipantArgs,
) {
  check(options, { eventId: String, participantId: String })

  if (!this.userId) {
    throw new Meteor.Error('notAuthorized', 'mustBeLoggedIn')
  }
  const event = await loadOwnEvent(options.eventId, this.userId)
  const participant = assertRemovable(event, options.participantId)

  // The pull only lands while they're still not the beneficiary: an
  // `events.update` may have made them one since the read. A placeholder
  // must still hold the photo the cascade deletes, so a newer one isn't left
  // behind.
  const photo = participant.kind === 'placeholder' ? participant.photo : null
  const stillRemovable = {
    _id: event._id,
    participants: {
      $elemMatch: { id: participant.id, photo: photo ?? { $exists: false } },
    },
    beneficiaryParticipantId: { $ne: participant.id },
  } as unknown as Mongo.Selector<EventDoc>
  const removed = await Events.updateAsync(stillRemovable, {
    $pull: { participants: { id: participant.id } },
  } as unknown as Mongo.Modifier<EventDoc>)
  if (!removed) {
    // Throws whichever reason now applies.
    assertRemovable(
      await loadOwnEvent(options.eventId, this.userId),
      options.participantId,
    )
    throw new Meteor.Error('serverError', 'concurrentChange')
  }

  await cascadeParticipantRemoval(event, participant)
  await syncChatThreads(event._id)
}

const deleteEvent = async function (
  this: Meteor.MethodThisType,
  options: { eventId: string },
) {
  check(options, { eventId: String })

  if (!this.userId) {
    throw new Meteor.Error('notAuthorized', 'mustBeLoggedIn')
  }
  const event = await loadOwnEvent(options.eventId, this.userId)

  await Events.removeAsync(event._id)
  await cascadeEventDeletion(event)
}

Meteor.methods({
  'events.create': createEvent,
  'events.update': updateEvent,
  'events.updateParticipant': updateParticipant,
  'events.join': joinEvent,
  'events.removeParticipant': removeParticipant,
  'events.delete': deleteEvent,
})
