import type { EventDoc, EventParticipant } from '@prezentowo/types'
import { Accounts } from 'meteor/accounts-base'
import { Random } from 'meteor/random'

import { syncChatThreads } from '../imports/api/chat/chat.sync'
import { Events } from '../imports/api/events/events.collection'
import '../imports/api/events/events.methods'
import '../imports/api/gifts/gifts.methods'
// Gives every user created here its `nameTokens`.
import '../imports/api/users/users.nameTokens'
import { callAsUser } from './helpers'

export async function createUser(name: string) {
  return Accounts.createUserAsync({
    email: `${name.toLowerCase()}@example.com`,
    profile: { name },
  })
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
