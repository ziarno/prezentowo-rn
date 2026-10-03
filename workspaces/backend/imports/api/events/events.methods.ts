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
} from '@prezentowo/types'
import { Match, check } from 'meteor/check'
import { Meteor } from 'meteor/meteor'
import type { Mongo } from 'meteor/mongo'
import { Random } from 'meteor/random'

import { recordParticipantJoined } from '../activity/activity.records'
import { syncChatThreads } from '../chat/chat.sync'
import { Gifts } from '../gifts/gifts.collection'
import { imageRefPattern } from '../images/images.patterns'
import {
  assertStockArt,
  releaseImage,
  withUploadAttached,
} from '../images/images.refs'
import { insertInvite } from '../invites/invites.codes'
import { eventForCode } from '../invites/invites.lookup'
import {
  clearInviteDeferred,
  recordParticipantJoined as notifyParticipantJoined,
} from '../notifications/notifications.records'
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
    if (p.kind === 'placeholder') {
      check(
        value,
        Match.ObjectIncluding({
          kind: String,
          name: String,
          color: String,
          avatar: Match.Maybe(String),
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

  // Mint an id per input entry, in order, so `beneficiaryIndex` can be
  // resolved. The host is always the caller: any `real` entry for them maps
  // to the one host participant, which is prepended exactly once.
  const minted = options.participants.map(
    (p): EventParticipant =>
      p.kind === 'real'
        ? p.userId === userId
          ? host
          : { id: Random.id(), kind: 'real', userId: p.userId }
        : {
            id: Random.id(),
            kind: 'placeholder',
            name: p.name.trim(),
            color: p.color,
            ...(p.avatar ? { avatar: p.avatar } : {}),
          },
  )
  const kind = resolveKind(
    options,
    minted.map(p => p.id),
  )

  const _id = await withUploadAttached(
    { image: options.background, userId },
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
    if (options.participantId) {
      const target = event.participants.find(
        p => p.id === options.participantId,
      )
      if (!target) {
        throw new Meteor.Error('notFound', 'placeholderNotFound')
      }
      if (target.kind !== 'placeholder') {
        throw new Meteor.Error('invalidArgs', 'mustBeAPlaceholder')
      }
      // The placeholder's id is kept, so gifts already on their list stay.
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
      await recordParticipantJoined(event._id, joinedAsParticipantId)
      await notifyParticipantJoined(event, joinedAsParticipantId)
      await clearInviteDeferred(userId, event._id)
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
  // `events.update` may have made them one since the read.
  const stillRemovable = {
    _id: event._id,
    'participants.id': participant.id,
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
  'events.join': joinEvent,
  'events.removeParticipant': removeParticipant,
  'events.delete': deleteEvent,
})
