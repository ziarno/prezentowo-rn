import type { EventDoc, InvitePreview } from '@prezentowo/types'
import { Meteor } from 'meteor/meteor'

import { findEventForCode } from './invites.lookup'

type Profile = { name?: string; avatar?: string; photo?: string }

// Everything `7a` shows before joining. UserIds and gifts never leave the
// server: real participants go out by name and avatar, and placeholders are
// listed only while unclaimed, and never a departed one. A reserved
// placeholder is listed only to `viewerId` when it's theirs, marked as such;
// signed out, none are.
export const invitePreview = (
  code: string,
  event: EventDoc,
  profileOf: (userId: string) => Profile | undefined,
  viewerId: string | null,
): InvitePreview => ({
  code,
  eventId: event._id,
  title: event.title,
  date: event.date,
  ...(event.background ? { background: event.background } : {}),
  inviterName: profileOf(event.ownerId)?.name ?? '',
  realParticipants: event.participants.flatMap(p => {
    if (p.kind !== 'real') return []
    const profile = profileOf(p.userId)
    return [
      {
        id: p.id,
        name: profile?.name ?? '',
        ...(profile?.avatar ? { avatar: profile.avatar } : {}),
        ...(profile?.photo ? { photo: profile.photo } : {}),
      },
    ]
  }),
  unclaimedPlaceholders: event.participants.flatMap(p => {
    if (p.kind !== 'placeholder' || p.departedUserId) return []
    const reservedForYou = !!p.invitedUserId && p.invitedUserId === viewerId
    if (p.invitedUserId && !reservedForYou) return []
    return [
      {
        id: p.id,
        name: p.name,
        color: p.color,
        ...(p.avatar ? { avatar: p.avatar } : {}),
        ...(p.photo ? { photo: p.photo } : {}),
        ...(reservedForYou ? { reservedForYou: true as const } : {}),
      },
    ]
  }),
})

// The profiles of the event's creator and real participants.
export async function profilesFor(event: EventDoc) {
  const userIds = [
    event.ownerId,
    ...event.participants.flatMap(p => (p.kind === 'real' ? [p.userId] : [])),
  ]
  const users = await Meteor.users
    .find(
      { _id: { $in: userIds } },
      {
        fields: { 'profile.name': 1, 'profile.avatar': 1, 'profile.photo': 1 },
      },
    )
    .fetchAsync()
  const byId = new Map(users.map(u => [u._id, u.profile as Profile]))
  return (userId: string) => byId.get(userId)
}

/**
 * The `InvitePreview` a code opens right now for a signed-out viewer, read
 * once — what `invites.byCode` would publish them first. Null for an unknown
 * or rotated code, or a deleted event, which all look the same.
 */
export async function loadInvitePreview(
  code: string,
): Promise<InvitePreview | null> {
  const event = await findEventForCode(code)
  if (!event) return null
  return invitePreview(code, event, await profilesFor(event), null)
}
