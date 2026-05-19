import type {
  CreateEventArgs,
  EventParticipant,
  EventParticipantInput,
} from '@prezentowo/types'
import { Match, check } from 'meteor/check'
import { Meteor } from 'meteor/meteor'
import { Random } from 'meteor/random'

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
        Match.ObjectIncluding({ kind: String, name: String, color: String }),
      )
      return true
    }
    return false
  },
)

const createEvent = async function (
  this: Meteor.MethodThisType,
  options: CreateEventArgs,
) {
  check(
    options,
    Match.ObjectIncluding({
      title: String,
      date: String,
      participants: [participantPattern],
    }),
  )

  if (!this.userId) {
    throw new Meteor.Error('notAuthorized', 'mustBeLoggedIn')
  }

  const title = options.title.trim()
  const date = options.date.trim()

  if (!title || !date) {
    throw new Meteor.Error('invalidArgs', 'missingFields')
  }

  // Host is always the caller — strip any duplicate "real" entry for them
  // before prepending, so the host appears exactly once and can't be omitted.
  const otherParticipants: EventParticipant[] = options.participants
    .filter(p => !(p.kind === 'real' && p.userId === this.userId))
    .map(p =>
      p.kind === 'real'
        ? { id: Random.id(), kind: 'real', userId: p.userId }
        : {
            id: Random.id(),
            kind: 'placeholder',
            name: p.name.trim(),
            color: p.color,
          },
    )

  const host: EventParticipant = {
    id: Random.id(),
    kind: 'real',
    userId: this.userId,
  }

  const _id = await Events.insertAsync({
    title,
    date,
    ownerId: this.userId,
    participants: [host, ...otherParticipants],
    createdAt: new Date(),
  } as Parameters<typeof Events.insertAsync>[0])

  return { _id }
}

const joinEvent = async function (
  this: Meteor.MethodThisType,
  options: { eventId: string; participantId?: string },
) {
  check(
    options,
    Match.ObjectIncluding({
      eventId: String,
      participantId: Match.Optional(String),
    }),
  )

  if (!this.userId) {
    throw new Meteor.Error('notAuthorized', 'mustBeLoggedIn')
  }

  const event = await Events.findOneAsync(options.eventId)
  if (!event) {
    throw new Meteor.Error('notFound', 'eventNotFound')
  }

  const userId = this.userId

  if (event.participants.some(p => p.kind === 'real' && p.userId === userId)) {
    throw new Meteor.Error('alreadyJoined', 'alreadyAParticipant')
  }

  let nextParticipants: EventParticipant[]
  if (options.participantId) {
    const target = event.participants.find(p => p.id === options.participantId)
    if (!target) {
      throw new Meteor.Error('notFound', 'placeholderNotFound')
    }
    if (target.kind !== 'placeholder') {
      throw new Meteor.Error('invalidArgs', 'mustBeAPlaceholder')
    }
    nextParticipants = event.participants.map(p =>
      p.id === options.participantId ? { id: p.id, kind: 'real', userId } : p,
    )
  } else {
    nextParticipants = [
      ...event.participants,
      { id: Random.id(), kind: 'real', userId },
    ]
  }

  await Events.updateAsync(options.eventId, {
    $set: { participants: nextParticipants },
  })
}

Meteor.methods({
  'events.create': createEvent,
  'events.join': joinEvent,
})
