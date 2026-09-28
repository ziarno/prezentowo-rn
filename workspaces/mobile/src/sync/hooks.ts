import { type DependencyList, useEffect } from 'react'

import { meteor } from './meteor'
import { status } from './session'
import { isSubscriptionReady, subscribe } from './subscriptions'

// Re-runs `fn` whenever a reactive source it read changes. `fn` is captured
// once per `deps` change, like `useMemo`.
export function useTracker<T>(fn: () => T, deps: DependencyList = []): T {
  return meteor.useTracker(fn, deps)
}

export function useSyncStatus() {
  return useTracker(() => status())
}

// Subscribes while mounted and `name`/`params` stay the same; `params: null`
// skips subscribing. Returns whether the subscription's data has arrived.
export function useSubscription(name: string, params: unknown[] | null) {
  // Params are read back from `key` so a new-but-equal array each render
  // doesn't resubscribe.
  const key = params ? JSON.stringify(params) : null

  useEffect(() => {
    if (key === null) return
    const handle = subscribe(name, ...(JSON.parse(key) as unknown[]))
    return () => handle.stop()
  }, [name, key])

  return useTracker(
    () => key !== null && isSubscriptionReady(name, JSON.parse(key)),
    [name, key],
  )
}
