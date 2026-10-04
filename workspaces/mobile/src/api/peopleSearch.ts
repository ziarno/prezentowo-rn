import type { UserSearchResult } from '@prezentowo/types'

import { call } from '@/sync'

// `4d`'s people search. Online-only: never queued, never cached.
export function searchUsers(query: string): Promise<UserSearchResult[]> {
  return call<UserSearchResult[]>('users.search', { query })
}
