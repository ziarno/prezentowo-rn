import type { JoinEventArgs } from '@prezentowo/types'
import * as SecureStore from 'expo-secure-store'

const KEY = 'prezentowo.pendingInvite'

// A signed-out `7a` Join, kept until the `(app)` guard opens and the join can
// run (docs/spec.md §4.2).
export async function savePendingInvite(invite: JoinEventArgs) {
  await SecureStore.setItemAsync(KEY, JSON.stringify(invite))
}

// Reads the pending invite and forgets it, so it's joined at most once.
export async function takePendingInvite(): Promise<JoinEventArgs | null> {
  const raw = await SecureStore.getItemAsync(KEY)
  if (raw === null) return null
  await SecureStore.deleteItemAsync(KEY)
  try {
    const { code, participantId } = JSON.parse(raw) as Partial<JoinEventArgs>
    if (typeof code !== 'string') return null
    return typeof participantId === 'string'
      ? { code, participantId }
      : { code }
  } catch {
    return null
  }
}
