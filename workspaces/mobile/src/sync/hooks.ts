import { type DependencyList, useEffect, useRef } from 'react'

import { meteor } from './meteor'
import { offlineSince, status } from './session'
import {
  type SubscriptionHandle,
  isSubscriptionReady,
  subscribe,
} from './subscriptions'

// Re-runs `fn` whenever a reactive source it read changes. `fn` is captured
// once per `deps` change, like `useMemo`.
export function useTracker<T>(fn: () => T, deps: DependencyList = []): T {
  return meteor.useTracker(fn, deps)
}

export function useSyncStatus() {
  return useTracker(() => status())
}

// Since when the session hasn't been ready (ms since the epoch), or null
// while it is.
export function useOfflineSince(): number | null {
  return useTracker(() => offlineSince())
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

// `useSubscription` for a varying list of ids: `name` is subscribed once per
// id, with that id as its only param. A changed list subscribes the new ids
// before it stops the dropped ones, so ids kept across the change never lose
// their data. Returns whether every id's data has arrived.
export function useSubscriptionPerId(name: string, ids: string[]) {
  const key = JSON.stringify([...new Set(ids)].sort())
  const handles = useRef(new Map<string, SubscriptionHandle>())

  useEffect(() => {
    const current = handles.current
    const wanted = new Set(JSON.parse(key) as string[])
    for (const id of wanted) {
      if (!current.has(id)) current.set(id, subscribe(name, id))
    }
    for (const [id, handle] of current) {
      if (wanted.has(id)) continue
      handle.stop()
      current.delete(id)
    }
  }, [name, key])

  useEffect(() => {
    const current = handles.current
    return () => {
      for (const handle of current.values()) handle.stop()
      current.clear()
    }
  }, [])

  return useTracker(
    () =>
      (JSON.parse(key) as string[]).every(id =>
        isSubscriptionReady(name, [id]),
      ),
    [name, key],
  )
}
