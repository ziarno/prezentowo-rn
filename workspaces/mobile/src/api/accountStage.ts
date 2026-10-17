import type { CurrentUser } from './users'

// Where the root guards send a person. Once signed in, it's derived from
// their user document, so every sign-in path — and any account that already
// exists without a name or an age band — goes through first-login.
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
  const named = !!user?.profile?.name?.trim()
  if (named && user?.ageBand) return 'app'
  // First-login asks for whatever is still missing: the name, and the age
  // band (docs/spec.md §1.15), which an account made before the question
  // existed answers once. A missing field only counts once the publication
  // that carries it has arrived, or the question would flash up for someone
  // who already answered:
  // - the name needs the `emails` Meteor publishes with the own document:
  //   without them the document hasn't arrived, the offline cache only kept
  //   the bare `{ _id }`, or only another publication's minimal profile is in.
  // - the band needs `createdAt`, which every user has and the second own
  //   publication sends together with `ageBand`.
  if (named ? user?.createdAt : user?.emails) return 'firstLogin'
  // Offline it may never arrive. This device signed them in before, so open
  // the app; first-login follows once the document says it should.
  return offline ? 'app' : 'loading'
}
