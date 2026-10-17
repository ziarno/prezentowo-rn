import { isSixteenPlus, todayUtc } from '@prezentowo/types'
import { useEffect, useState } from 'react'
import { AppState } from 'react-native'

import { useCurrentUser } from '@/hooks/useCurrentUser'

// The current UTC day, `YYYY-MM-DD` (docs/spec.md §1.15), read again each
// time the app comes to the foreground, so a user who turns 16 while the app
// sits in the background sees the change on opening it.
export function useToday(): string {
  const [today, setToday] = useState(() => todayUtc())

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') setToday(todayUtc())
    })
    return () => subscription.remove()
  }, [])

  return today
}

// Whether the signed-in user is 16 or over today (push and being found by
// name start then). False until the user document says so.
export function useSixteenPlus(): boolean {
  return isSixteenPlus(useCurrentUser(), useToday())
}
