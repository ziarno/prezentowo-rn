import type { AvatarKey } from './avatars'

export type SampleParticipant = {
  name: string
  avatar: AvatarKey
}

export const sampleParticipants: SampleParticipant[] = [
  { name: 'Klaudia', avatar: 'f1' },
  { name: 'Marek', avatar: 'm2' },
  { name: 'Ela', avatar: 'f2' },
  { name: 'Tomasz', avatar: 'm3' },
  { name: 'Ola', avatar: 'f3' },
  { name: 'Piotr', avatar: 'm4' },
  { name: 'Hania', avatar: 'f4' },
  { name: 'You', avatar: 'm1' },
]
