import { parseMagicLink } from '@/hooks/useMagicLinkDeepLink'

// A magic link isn't a screen: `useMagicLinkDeepLink` signs in from it and the
// root guards route the user afterwards. Launched by the link, start at the
// root like a normal cold start; while running, stay where the user is (a
// null return skips navigation).
export function redirectSystemPath({
  path,
  initial,
}: {
  path: string
  initial: boolean
}) {
  try {
    if (parseMagicLink(path)) return initial ? '/' : null
  } catch {
    // Never crash here; let the router handle the path as it is.
  }
  return path
}
