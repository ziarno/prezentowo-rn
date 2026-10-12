import type { PushPermission } from './permission'

// SecureStore key: the sheet has been shown on this device.
export const PRE_PROMPT_SHOWN_KEY = 'prezentowo.pushPrePromptShown'

export type PushPrePromptDeps = {
  permission: () => Promise<PushPermission>
  store: {
    get: (key: string) => Promise<string | null>
    set: (key: string, value: string) => Promise<void>
  }
}

/**
 * The sheet that asks before the OS does (docs/spec.md §10.5). `offer()`
 * comes after the user creates or joins an event; it opens the sheet only the
 * first time, and only while the OS hasn't asked yet. Shown once per device,
 * kept in SecureStore, so "Not now" never comes back by itself: the push
 * settings screen is the way back.
 */
export function createPushPrePrompt({ permission, store }: PushPrePromptDeps) {
  let open = false
  const listeners = new Set<() => void>()
  let queue: Promise<void> = Promise.resolve()

  const setOpen = (next: boolean) => {
    if (next === open) return
    open = next
    listeners.forEach(listener => listener())
  }

  return {
    isOpen: () => open,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => void listeners.delete(listener)
    },
    offer(): Promise<void> {
      queue = queue
        .then(async () => {
          if ((await store.get(PRE_PROMPT_SHOWN_KEY)) !== null) return
          if ((await permission()) !== 'undetermined') return
          await store.set(PRE_PROMPT_SHOWN_KEY, '1')
          setOpen(true)
        })
        .catch(() => {})
      return queue
    },
    close: () => setOpen(false),
  }
}

export type PushPrePrompt = ReturnType<typeof createPushPrePrompt>
