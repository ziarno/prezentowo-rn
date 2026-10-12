import { useEffect } from 'react'
import { AppState } from 'react-native'

import { pushDevice, pushPermission } from '@/push'
import { sessionToken, useSyncStatus, useTracker } from '@/sync'

// Keeps the push registry told whether the user is signed in and the server
// reachable: it registers this device on each start and sign-in, waiting for
// the connection when offline (docs/spec.md §10.5). The OS permission is
// re-read on each app focus, so allowing pushes in system Settings registers
// on the way back (§10.2).
export function usePushRegistration() {
  const signedIn = useTracker(() => sessionToken() !== null)
  const online = useSyncStatus() === 'connected'

  useEffect(() => {
    pushDevice.setSession({ signedIn, online })
  }, [signedIn, online])

  useEffect(() => {
    void pushPermission.refresh()
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') void pushPermission.refresh()
    })
    return () => subscription.remove()
  }, [])
}
