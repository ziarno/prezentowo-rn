import type { PushKind, PushPreferences } from '@prezentowo/types'

// A missing kind is on (docs/spec.md §1.13).
export const pushPreferenceOn = (
  preferences: PushPreferences | undefined,
  kind: PushKind,
) => preferences?.[kind] !== false

export type PushToggles = Partial<Record<PushKind, boolean>>

// The switches the user flipped that the user document doesn't show yet. A
// save's answer comes before the document's change, so a switch keeps its
// toggled value until the document catches up, never flicking back.
export function unconfirmedToggles(
  toggled: PushToggles,
  preferences: PushPreferences | undefined,
): PushToggles {
  const kinds = Object.keys(toggled) as PushKind[]
  const left = kinds.filter(
    kind => pushPreferenceOn(preferences, kind) !== toggled[kind],
  )
  if (left.length === kinds.length) return toggled
  return Object.fromEntries(left.map(kind => [kind, toggled[kind]]))
}
