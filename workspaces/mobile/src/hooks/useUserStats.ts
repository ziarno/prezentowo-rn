import type { UserStats } from '@prezentowo/types'
import { useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'

import { fetchUserStats, saveUserStats, savedUserStats } from '@/api/users'

// Profile's counts: the saved ones at once, then fresh on every focus. A
// failed call (offline included) shows nothing and keeps what's there
// (docs/spec.md §10.3).
export function useUserStats(): UserStats | undefined {
  const [stats, setStats] = useState(savedUserStats)

  useFocusEffect(
    useCallback(() => {
      let current = true
      fetchUserStats().then(
        fresh => {
          if (!current) return
          setStats(fresh)
          saveUserStats(fresh)
        },
        () => {},
      )
      return () => {
        current = false
      }
    }, []),
  )

  return stats
}
