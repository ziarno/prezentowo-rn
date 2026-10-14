import { type AccountStage, accountStage } from '@/api/accountStage'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useOffline } from '@/hooks/useOffline'
import { sessionToken, useTracker } from '@/sync'

export function useAccountStage(): AccountStage {
  // Read straight from the session, not a copy synced in an effect: a copy
  // lags a render behind, and that render shows the signed-out screens.
  const signedIn = !!useTracker(() => sessionToken())
  const user = useCurrentUser()
  const offline = useOffline()
  return accountStage({ signedIn, user, offline })
}
