import { useEffect } from 'react'

import { pushDevice } from '@/push'
import { sessionToken, useSyncStatus, useTracker } from '@/sync'

// Keeps the push registry told whether the user is signed in and the server
// reachable: it registers this device on each start and sign-in, waiting for
// the connection when offline (docs/spec.md §10.5).
export function usePushRegistration() {
  const signedIn = useTracker(() => sessionToken() !== null)
  const online = useSyncStatus() === 'connected'

  useEffect(() => {
    pushDevice.setSession({ signedIn, online })
  }, [signedIn, online])
}
