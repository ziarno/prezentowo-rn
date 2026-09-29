import type { EventDoc } from '@prezentowo/types'
import { Accounts } from 'meteor/accounts-base'

import { Events } from '../imports/api/events/events.collection'
import '../imports/api/events/events.methods'
import '../imports/api/gifts/gifts.methods'
import { callAsUser } from './helpers'

export async function createUser(name: string) {
  return Accounts.createUserAsync({
    email: `${name.toLowerCase()}@example.com`,
    profile: { name },
  })
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
      participants: [
        { kind: 'real', userId: bartek },
        { kind: 'real', userId: celina },
        { kind: 'placeholder', name: 'Dziadek', color: '#c33' },
      ],
    },
  )
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
