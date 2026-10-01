import { router } from 'expo-router'
import { useEffect, useRef } from 'react'

import { joinEvent } from '@/api/events'
import { claimInstallReferrerInvite } from '@/store/installReferrer'
import { takePendingInvite } from '@/store/pendingInvite'

// Runs the join a signed-out `7a` left behind as soon as the app opens, then
// replaces into the event. A join that fails (the placeholder was taken
// meanwhile, they're already in, they're offline) reopens `7a` for that code,
// which explains it and lets them try again. On Android, an invite the Play
// Store install carried becomes the pending one first.
export function usePendingInvite(appOpen: boolean) {
  // One take at a time: a re-run effect (StrictMode) could otherwise read the
  // invite twice before either deletes it, and join twice.
  const taking = useRef(false)

  useEffect(() => {
    if (!appOpen || taking.current) return
    taking.current = true
    claimInstallReferrerInvite()
      .then(takePendingInvite)
      .then(invite => {
        if (!invite) return
        return joinEvent(invite).then(
          ({ eventId }) =>
            router.replace({
              pathname: '/event/[eventId]',
              params: { eventId },
            }),
          () =>
            router.push({
              pathname: '/e/[code]',
              params: { code: invite.code },
            }),
        )
      })
      .catch(() => {})
      .finally(() => (taking.current = false))
  }, [appOpen])
}
