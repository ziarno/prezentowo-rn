import { useSyncExternalStore } from 'react'

import { type PushPermission, pushPermission } from '@/push'

// The OS permission for pushes, null until first read. Re-read on each app
// focus by `usePushRegistration`.
export function usePushPermission(): PushPermission | null {
  return useSyncExternalStore(pushPermission.subscribe, pushPermission.get)
}
