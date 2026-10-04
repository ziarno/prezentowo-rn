import type { CurrentUser } from './users'

// Where the root guards send a person. Once signed in, it's derived from
// their user document, so every sign-in path — and any account that already
// exists without a name — goes through first-login.
export type AccountStage = 'signedOut' | 'loading' | 'firstLogin' | 'app'

type AccountStageInput = {
  signedIn: boolean
  user: CurrentUser | undefined
  // The server has been unreachable past the grace period.
  offline: boolean
}

export function accountStage({
  signedIn,
  user,
  offline,
}: AccountStageInput): AccountStage {
  if (!signedIn) return 'signedOut'
  if (user?.profile?.name?.trim()) return 'app'
  // Every account signs in by email, and Meteor publishes the signed-in
  // user's own `emails` with their document, so without them the name isn't
  // known yet: the document hasn't arrived, the offline cache only kept the
  // bare `{ _id }`, or only another publication's minimal profile is in.
  if (user?.emails) return 'firstLogin'
  // Offline it may never arrive. This device signed them in before, so open
  // the app; first-login follows once the document says it should.
  return offline ? 'app' : 'loading'
}
