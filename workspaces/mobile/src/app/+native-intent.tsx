import { isMagicLink } from '@/api/magicLink'

// A magic link isn't a screen: `useMagicLinkDeepLink` signs in from it (a
// broken one is just ignored) and the root guards route the user afterwards.
// Launched by the link, start at the root like a normal cold start; while
// running, stay where the user is (expo-router skips navigation on null).
// `isMagicLink` never throws, so this can't crash the router.
export function redirectSystemPath({
  path,
  initial,
}: {
  path: string
  initial: boolean
}) {
  if (isMagicLink(path)) return initial ? '/' : null
  return path
}
