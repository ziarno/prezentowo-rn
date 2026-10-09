// PROTOTYPE (#86) — throwaway. In-memory fake state for the Profile / push
// settings prototype. Nothing here is persisted or sent to the server.
import { useSyncExternalStore } from 'react'

export type Permission = 'undetermined' | 'granted' | 'denied'
export type PushKind =
  | 'invited'
  | 'suggestion-claimed'
  | 'claimed-gift-removed'
  | 'participant-joined'
  | 'chat'

export const PUSH_KINDS: PushKind[] = [
  'invited',
  'suggestion-claimed',
  'claimed-gift-removed',
  'participant-joined',
  'chat',
]

export const VARIANTS = [
  { key: 'A', name: 'Ledger' },
  { key: 'B', name: 'Grouped cards' },
  { key: 'C', name: 'Account sheet' },
] as const
export type VariantKey = (typeof VARIANTS)[number]['key']

type State = {
  variant: VariantKey
  permission: Permission
  offline: boolean
  // Pending + failed writes in the offline queue.
  queued: number
  hasPhoto: boolean
  prefs: Record<PushKind, boolean>
  prePromptOpen: boolean
  panelOpen: boolean
}

let state: State = {
  variant: 'A',
  permission: 'undetermined',
  offline: false,
  queued: 0,
  hasPhoto: false,
  prefs: {
    invited: true,
    'suggestion-claimed': true,
    'claimed-gift-removed': true,
    'participant-joined': true,
    chat: true,
  },
  prePromptOpen: false,
  panelOpen: false,
}

const listeners = new Set<() => void>()

export function setProto(patch: Partial<State>) {
  state = { ...state, ...patch }
  listeners.forEach(l => l())
}

export function useProto() {
  return useSyncExternalStore(
    l => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => state,
  )
}

// The Profile row's subtitle: "Off" whenever the OS won't deliver anything.
export function pushSummary(s: State): 'On' | 'Off' | 'Some' {
  if (s.permission !== 'granted') return 'Off'
  const on = PUSH_KINDS.filter(k => s.prefs[k]).length
  return on === PUSH_KINDS.length ? 'On' : on === 0 ? 'Off' : 'Some'
}
