import Meteor from '@meteorrn/core'

import { type CurrentUser, getCurrentUser } from '@/api/users'

export function useCurrentUser(): CurrentUser | undefined {
  return Meteor.useTracker(() => getCurrentUser())
}
