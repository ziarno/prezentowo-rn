import { type AccountStage, accountStage } from '@/api/accountStage'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useOffline } from '@/hooks/useOffline'
import { useAuthStore } from '@/store/useAuthStore'

export function useAccountStage(): AccountStage {
  const signedIn = !!useAuthStore(s => s.userToken)
  const user = useCurrentUser()
  const offline = useOffline()
  return accountStage({ signedIn, user, offline })
}
