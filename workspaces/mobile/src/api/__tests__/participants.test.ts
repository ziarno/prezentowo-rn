import type { EventDoc } from '@prezentowo/types'

import {
  participantOfStreamUser,
  resolveParticipants,
} from '@/api/participants'
import type { PublicUser } from '@/api/users'

const event = {
  participants: [
    { id: 'p-ola', kind: 'real', userId: 'u-ola' },
    {
      id: 'p-gone',
      kind: 'placeholder',
      name: 'Marek',
      color: '#c33',
      avatar: 'm3',
      departedUserId: 'u-marek',
    },
    { id: 'p-babcia', kind: 'placeholder', name: 'Babcia', color: '#3c3' },
  ],
} as unknown as EventDoc

const users: Record<string, PublicUser> = {
  'u-ola': {
    _id: 'u-ola',
    profile: { name: 'Ola', avatar: 'f2', photo: 'upload-1' },
  } as PublicUser,
}

const participants = resolveParticipants(event, 'u-ola', id => users[id])

describe('participantOfStreamUser', () => {
  test("finds a real participant by their userId, with their profile's picture", () => {
    expect(participantOfStreamUser(participants, 'u-ola')).toMatchObject({
      id: 'p-ola',
      name: 'Ola',
      avatarKey: 'f2',
      photo: 'upload-1',
    })
  })

  test("finds a deleted account's departed placeholder by its former userId", () => {
    expect(participantOfStreamUser(participants, 'u-marek')).toMatchObject({
      id: 'p-gone',
      avatarKey: 'm3',
      color: '#c33',
    })
  })

  test('is undefined for a user who is not in the event', () => {
    expect(participantOfStreamUser(participants, 'u-stranger')).toBeUndefined()
  })

  test('never matches a placeholder by its participant id', () => {
    expect(participantOfStreamUser(participants, 'p-babcia')).toBeUndefined()
  })
})
