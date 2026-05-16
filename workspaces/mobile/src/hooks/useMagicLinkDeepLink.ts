import * as Linking from 'expo-linking'
import { useEffect } from 'react'

import { useAuth } from '@/hooks/useAuth'
import { useAuthStore } from '@/store/useAuthStore'

const PATH = 'magic-link'

function parseMagicLink(url: string) {
  const parsed = Linking.parse(url)
  if (parsed.path !== PATH && parsed.hostname !== PATH) return null

  const q = parsed.queryParams ?? {}
  const email = typeof q.email === 'string' ? q.email : null
  const token = typeof q.token === 'string' ? q.token : null
  if (!email || !token) return null

  return { email, token }
}

export function useMagicLinkDeepLink() {
  const setPendingEmail = useAuthStore(s => s.setPendingEmail)
  const { loginWithMagicToken } = useAuth()

  useEffect(() => {
    const handle = (url: string | null) => {
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
    }

    Linking.getInitialURL().then(handle)
    const sub = Linking.addEventListener('url', ({ url }) => handle(url))
    return () => sub.remove()
  }, [loginWithMagicToken, setPendingEmail])
}
