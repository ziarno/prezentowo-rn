import type { InviteDoc, InvitePreview } from '@prezentowo/types'

import { WEB_URL } from '@/constants/web'
import { call, collection } from '@/sync'

// Client-only: `invites.byCode` publishes one preview per code, keyed by it.
const InvitePreviews = collection<InvitePreview & { _id: string }>(
  'invitePreviews',
)
// The creator's own invite, from `invites.forEvent`.
const Invites = collection<InviteDoc>('invites')

// The share link, in its current best form (docs/spec.md §4.3): a Universal
// Link / App Link that opens the app when it's installed, and the web landing
// page when it isn't. `prezentowo://e/<code>` still opens the app.
export const inviteLink = (code: string) =>
  `${WEB_URL}/e/${encodeURIComponent(code)}`

export function findInvitePreview(code: string): InvitePreview | undefined {
  return InvitePreviews.findOne(code)
}

export function findInviteForEvent(eventId: string): InviteDoc | undefined {
  return Invites.findOne({ eventId })
}

export function ignoreInvite(code: string): Promise<void> {
  return call('invites.ignore', { code })
}

// `6a`'s Rotate link: the old code stops working at once.
export function rotateInvite(eventId: string): Promise<void> {
  return call('invites.rotate', { eventId })
}
