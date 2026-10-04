// The sign-in link the backend mails: `prezentowo://magic-link?email=…&token=…`
// (`workspaces/backend/imports/startup/server/accounts.emails.ts`). Plain
// `URL` (Expo polyfills it), so it loads in Node tests and in +native-intent.
const PATH = 'magic-link'

// The link as a `URL` if it's aimed at `magic-link`, usable or not.
function magicLinkURL(url: string) {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  const aimed =
    parsed.hostname === PATH || parsed.pathname.replace(/^\/+/, '') === PATH
  return aimed ? parsed : null
}

// None of these is a screen, even one missing its email or token.
export function isMagicLink(url: string) {
  return magicLinkURL(url) !== null
}

export function parseMagicLink(url: string) {
  const params = magicLinkURL(url)?.searchParams
  const email = params?.get('email')
  const token = params?.get('token')
  if (!email || !token) return null
  return { email, token }
}
