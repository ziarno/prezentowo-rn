import { useEffect } from 'react'
import { AppState } from 'react-native'

import { useSixteenPlus } from '@/hooks/useToday'
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
  // Push is for 16+ only; until the user document says so, nothing registers.
  // Judged against today, read again on each app focus, so turning 16
  // registers the device without a reinstall.
  const sixteenPlus = useSixteenPlus()

  useEffect(() => {
    pushDevice.setSession({ signedIn, online, sixteenPlus })
  }, [signedIn, online, sixteenPlus])

  useEffect(() => {
    void pushPermission.refresh()
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') void pushPermission.refresh()
    })
    return () => subscription.remove()
  }, [])
}
