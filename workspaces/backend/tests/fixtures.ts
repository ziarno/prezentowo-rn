import {
  type EventDoc,
  type EventParticipant,
  latestBirthDateAtAge,
} from '@prezentowo/types'
import { Accounts } from 'meteor/accounts-base'
import { Meteor } from 'meteor/meteor'
import { Random } from 'meteor/random'

import { syncChatThreads } from '../imports/api/chat/chat.sync'
import { Events } from '../imports/api/events/events.collection'
import '../imports/api/events/events.methods'
import '../imports/api/gifts/gifts.methods'
import { today } from '../imports/api/today'
// Gives every user created here its `nameTokens`.
import '../imports/api/users/users.nameTokens'
import { callAsUser } from './helpers'

/** The day `n` days after (or, negative, before) `day`, as `YYYY-MM-DD`. */
export const addDays = (day: string, n: number) =>
  new Date(Date.parse(day) + n * 86_400_000).toISOString().slice(0, 10)

/**
 * The birth date of someone who turns `age` today, so they are exactly that
 * old. Relative to `today()`, so a test doesn't age as the calendar moves.
 */
export const bornAged = (age: number) => latestBirthDateAtAge(age, today())

/** The birth date of someone who turns 16 tomorrow: 15 years, 364 days old. */
export const turnsSixteenTomorrow = () => addDays(bornAged(16), 1)

export async function createUser(name: string, birthDate?: string) {
  const userId = await Accounts.createUserAsync({
    email: `${name.toLowerCase()}@example.com`,
    profile: { name },
  })
  if (birthDate) await Meteor.users.updateAsync(userId, { $set: { birthDate } })
  return userId
}

/**
 * Seats `userIds` as real participants right after the host, as though each
 * had already joined by invite, but without the activity and notifications a
 * join writes. `events.create` only ever makes the caller a member.
 */
export async function seatMembers(eventId: string, userIds: string[]) {
  const event = (await Events.findOneAsync(eventId)) as EventDoc
  const [host, ...rest] = event.participants
  const seated = userIds.map(
    (userId): EventParticipant => ({ id: Random.id(), kind: 'real', userId }),
  )
  await Events.updateAsync(eventId, {
    $set: { participants: [host!, ...seated, ...rest] },
  })
  await syncChatThreads(eventId)
  return seated.map(p => p.id)
}

/**
 * A many-to-many event created by `ownerId` with `memberIds` seated as real
 * participants (see seatMembers). Returns its id.
 */
export async function createEventWithMembers(
  ownerId: string,
  memberIds: string[],
  title = 'Urodziny',
) {
  const { _id: eventId } = await callAsUser<{ _id: string }>(
    ownerId,
    'events.create',
    { title, date: '2026-05-04', type: 'many-to-many', participants: [] },
  )
  await seatMembers(eventId, memberIds)
  return eventId
}

/**
 * An event created by Ola with Bartek and Celina as real participants and
 * Dziadek as a placeholder. Returns every user and participant id by name.
 */
export async function createFamilyEvent() {
  const ola = await createUser('Ola')
  const bartek = await createUser('Bartek')
  const celina = await createUser('Celina')
  const outsider = await createUser('Outsider')

  const { _id: eventId } = await callAsUser<{ _id: string }>(
    ola,
    'events.create',
    {
      title: 'Wigilia',
      date: '2026-12-24',
      type: 'many-to-many',
      participants: [{ kind: 'placeholder', name: 'Dziadek', color: '#c33' }],
    },
  )
  await seatMembers(eventId, [bartek, celina])
  const event = (await Events.findOneAsync(eventId)) as EventDoc
  const participantIdOf = (userId: string) =>
    event.participants.find(p => p.kind === 'real' && p.userId === userId)!.id

  return {
    eventId,
    users: { ola, bartek, celina, outsider },
    participants: {
      ola: participantIdOf(ola),
      bartek: participantIdOf(bartek),
      celina: participantIdOf(celina),
      dziadek: event.participants.find(p => p.kind === 'placeholder')!.id,
    },
  }
}

export async function addGiftAs(
  userId: string,
  eventId: string,
  forParticipantId: string,
  title: string,
  extra: Record<string, unknown> = {},
) {
  const { _id } = await callAsUser<{ _id: string }>(userId, 'gifts.add', {
    eventId,
    forParticipantId,
    title,
    ...extra,
  })
  return _id
}
