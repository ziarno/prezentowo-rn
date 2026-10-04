import * as Linking from 'expo-linking'
import { useEffect, useEffectEvent } from 'react'

import { parseMagicLink } from '@/api/magicLink'
import { useAuth } from '@/hooks/useAuth'
import { useAuthStore } from '@/store/useAuthStore'

// The launch URL stays the same for the whole process, so a remount (Fast
// Refresh, StrictMode) must not sign in with its already-spent token again.
let initialURLHandled = false

// Signs in from `prezentowo://magic-link?email=…&token=…`. There's no
// `magic-link` route: `src/app/+native-intent.tsx` keeps the router from
// navigating to one, and the root guards move the user once signed in.
export function useMagicLinkDeepLink() {
  const setPendingEmail = useAuthStore(s => s.setPendingEmail)
  const { loginWithMagicToken } = useAuth()

  const handle = useEffectEvent((url: string | null) => {
    if (!url) return
    const parsed = parseMagicLink(url)
    if (!parsed) return
    setPendingEmail(parsed.email)
    loginWithMagicToken({
      email: parsed.email,
      token: parsed.token,
      onSuccess: () => {},
      onError: () => {},
    })
  })

  useEffect(() => {
    if (!initialURLHandled) {
      initialURLHandled = true
      Linking.getInitialURL().then(handle)
    }
    const sub = Linking.addEventListener('url', ({ url }) => handle(url))
    return () => sub.remove()
  }, [])
}
