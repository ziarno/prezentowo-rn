import {
  BACKGROUND_ILLUSTRATION_IDS,
  type CreateEventArgs,
  type EventDoc,
  type EventKind,
  type EventParticipant,
  type EventParticipantInput,
  type JoinEventArgs,
  type JoinEventResult,
} from '@prezentowo/types'
import { Match, check } from 'meteor/check'
import { Meteor } from 'meteor/meteor'
import type { Mongo } from 'meteor/mongo'
import { Random } from 'meteor/random'

import { imageRefPattern } from '../images/images.patterns'
import { assertOwnUpload, assertStockArt } from '../images/images.refs'
import { insertInvite } from '../invites/invites.codes'
import { eventForCode } from '../invites/invites.lookup'
import { Events } from './events.collection'

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
  await assertOwnUpload(options.background, userId)

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

  const _id = await Events.insertAsync({
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
    await insertInvite(_id, userId)
  } catch (error) {
    await Events.removeAsync(_id)
    throw error
  }

  return { _id }
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
      nextParticipants = event.participants.map(p =>
        p.id === target.id ? { id: p.id, kind: 'real', userId } : p,
      )
    } else {
      nextParticipants = [
        ...event.participants,
        { id: Random.id(), kind: 'real', userId },
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
    if (updated) return { eventId: event._id }
  }
  throw new Meteor.Error('serverError', 'concurrentJoin')
}

Meteor.methods({
  'events.create': createEvent,
  'events.join': joinEvent,
})
