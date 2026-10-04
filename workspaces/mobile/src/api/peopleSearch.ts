import type { UserSearchResult } from '@prezentowo/types'

import { type MeteorError, call } from '@/sync'

// When the server gives no time to wait, e.g. an older one.
const DEFAULT_RETRY_MS = 1000

// `4d`'s people search. Online-only: never queued, never cached.
export function searchUsers(query: string): Promise<UserSearchResult[]> {
  return call<UserSearchResult[]>('users.search', { query })
}

/**
 * How long to wait before asking again after `error`, when it's
 * `users.search`'s rate limit (DDPRateLimiter says how long, in ms), or null
 * for any other failure.
 */
export function rateLimitRetryMs(error: unknown): number | null {
  const { error: code, details } = (error ?? {}) as Partial<
    Omit<MeteorError, 'details'>
  > & { details?: { timeToReset?: unknown } }
  if (code !== 'too-many-requests') return null
  const wait = details?.timeToReset
  return typeof wait === 'number' && wait > 0 ? wait : DEFAULT_RETRY_MS
}
