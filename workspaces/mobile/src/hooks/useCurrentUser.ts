import { type CurrentUser, getCurrentUser } from '@/api/users'
import { useTracker } from '@/sync'

export function useCurrentUser(): CurrentUser | undefined {
  return useTracker(() => getCurrentUser())
}
