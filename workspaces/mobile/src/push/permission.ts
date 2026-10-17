import { PUSH_KINDS, type PushPreferences } from '@prezentowo/types'

// The OS's say on pushes for this app (docs/spec.md §10.2). `undetermined`
// means the app can still show the OS prompt.
export type PushPermission = 'undetermined' | 'granted' | 'denied'

// Profile's Push notifications subtitle (docs/spec.md §10.1): from the
// toggles, unless the OS isn't delivering anything, or the user is under 16
// and has no push at all (§1.15).
export type PushSummary =
  | 'on'
  | 'some'
  | 'off'
  | 'offInSettings'
  | 'sixteenPlus'

export function pushSummary(
  permission: PushPermission,
  preferences: PushPreferences,
  sixteenPlus: boolean,
): PushSummary {
  if (!sixteenPlus) return 'sixteenPlus'
  if (permission !== 'granted') return 'offInSettings'
  const on = PUSH_KINDS.filter(kind => preferences[kind] !== false).length
  return on === PUSH_KINDS.length ? 'on' : on === 0 ? 'off' : 'some'
}

export type PushPermissionDeps = {
  // The OS's current answer. Never asks.
  read: () => Promise<PushPermission>
  // Shows the OS prompt (or answers at once if it can't be shown again).
  request: () => Promise<PushPermission>
  // Pushes became allowed: the server should hear about this device.
  onGranted: () => void
}

/**
 * The OS permission as the app last read it, re-read on each app focus so
 * coming back from system Settings counts (docs/spec.md §10.2). A change to
 * granted, from Settings or the prompt, calls `onGranted`; the first read
 * doesn't, since the start registers anyway (§10.5). One read at a time, so
 * an older answer never replaces a newer one.
 */
export function createPushPermission({
  read,
  request,
  onGranted,
}: PushPermissionDeps) {
  let current: PushPermission | null = null
  const listeners = new Set<() => void>()
  let queue: Promise<void> = Promise.resolve()

  const settle = (next: PushPermission, asked: boolean) => {
    const previous = current
    if (next === previous) return
    current = next
    listeners.forEach(listener => listener())
    if (next === 'granted' && (previous !== null || asked)) onGranted()
  }

  const run = (step: () => Promise<void>) => {
    queue = queue.then(step).catch(() => {})
    return queue
  }

  return {
    get: () => current,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => void listeners.delete(listener)
    },
    refresh: () => run(async () => settle(await read(), false)),
    request: () => run(async () => settle(await request(), true)),
  }
}

export type PushPermissionStore = ReturnType<typeof createPushPermission>
