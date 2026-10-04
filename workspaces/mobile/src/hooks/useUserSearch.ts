import { type UserSearchResult, isSearchableQuery } from '@prezentowo/types'
import { useEffect, useState } from 'react'

import { rateLimitRetryMs, searchUsers } from '@/api/peopleSearch'
import { useOffline } from '@/hooks/useOffline'

// How long typing has to pause before `4d` searches.
const DEBOUNCE_MS = 300

export type UserSearch =
  // Too short to search yet.
  | { status: 'idle' }
  | { status: 'offline' }
  | { status: 'loading' }
  | { status: 'done'; results: UserSearchResult[] }
  | { status: 'failed' }

type Settled = Exclude<UserSearch, { status: 'idle' | 'offline' | 'loading' }>

/**
 * `4d`'s people search for `query`, once typing pauses. While a longer or
 * edited query is on its way the last answer stays up, so the list doesn't
 * blink on every keystroke. Hitting `users.search`'s rate limit isn't the
 * user's problem: it shows as loading and asks again once the limit resets.
 * Offline it doesn't search at all.
 */
export function useUserSearch(query: string): UserSearch {
  const offline = useOffline()
  // The server answers nothing to a shorter query, so it isn't asked.
  const searchable = isSearchableQuery(query)
  const [settled, setSettled] = useState<Settled | null>(null)
  // A cleared field starts over: an earlier answer never stands in for a
  // query typed afresh.
  if (!searchable && settled) setSettled(null)

  useEffect(() => {
    if (!searchable || offline) return
    let current = true
    let timer: ReturnType<typeof setTimeout>
    const ask = () => {
      searchUsers(query).then(
        results => current && setSettled({ status: 'done', results }),
        error => {
          if (!current) return
          const retryMs = rateLimitRetryMs(error)
          if (retryMs === null) return setSettled({ status: 'failed' })
          setSettled(null)
          timer = setTimeout(ask, retryMs)
        },
      )
    }
    timer = setTimeout(ask, DEBOUNCE_MS)
    return () => {
      current = false
      clearTimeout(timer)
    }
  }, [query, searchable, offline])

  if (!searchable) return { status: 'idle' }
  if (offline) return { status: 'offline' }
  return settled ?? { status: 'loading' }
}
