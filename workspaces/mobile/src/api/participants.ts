import type { EventDoc, EventParticipant } from '@prezentowo/types'

import type { PublicUser } from './users'

export type ResolvedParticipant = {
  id: string
  name: string
  // Avatar key (e.g. "f1") when one is known — real user's chosen avatar or a
  // placeholder's avatar. Falls back to a colored initial when absent.
  avatarKey?: string
  // An upload id, shown instead of `avatarKey`: a real user's own photo, or
  // one the creator gave a placeholder (docs/spec.md §1.10, §1.11).
  photo?: string
  // Placeholder accent color, used for the initial-circle fallback.
  color?: string
  isYou: boolean
  isPlaceholder: boolean
  userId?: string
}

export function resolveParticipant(
  participant: EventParticipant,
  currentUserId: string | undefined,
  getUser: (userId: string) => PublicUser | undefined,
): ResolvedParticipant {
  if (participant.kind === 'real') {
    const user = getUser(participant.userId)
    return {
      id: participant.id,
      name: user?.profile?.name?.trim() || 'Member',
      avatarKey: user?.profile?.avatar,
      photo: user?.profile?.photo,
      isYou: participant.userId === currentUserId,
      isPlaceholder: false,
      userId: participant.userId,
    }
  }
  return {
    id: participant.id,
    name: participant.name,
    avatarKey: participant.avatar,
    photo: participant.photo,
    color: participant.color,
    isYou: false,
    isPlaceholder: true,
  }
}

export function resolveParticipants(
  event: EventDoc,
  currentUserId: string | undefined,
  getUser: (userId: string) => PublicUser | undefined,
): ResolvedParticipant[] {
  return event.participants.map(p =>
    resolveParticipant(p, currentUserId, getUser),
  )
}
