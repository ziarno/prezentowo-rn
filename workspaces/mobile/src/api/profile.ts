import { WEB_URL } from '@/constants/web'

export type LegalPage = 'privacy' | 'terms'

// The landing site's legal pages, in the app's language (docs/spec.md §3.7).
export const legalPageUrl = (page: LegalPage, lang: string) =>
  `${WEB_URL}/${page}?lang=${encodeURIComponent(lang)}`

// About's Version row: `expo-application`'s version and build, e.g.
// "1.2.0 (42)".
export function versionLabel(
  version: string | null,
  build: string | null,
): string | null {
  if (!version) return null
  return build ? `${version} (${build})` : version
}

// "Joined <month 'yy>", e.g. "Aug '26".
export function formatJoined(
  createdAt: Date | string | undefined,
  locale: string,
): string | null {
  if (!createdAt) return null
  const date = createdAt instanceof Date ? createdAt : new Date(createdAt)
  if (Number.isNaN(date.getTime())) return null
  const month = new Intl.DateTimeFormat(locale, { month: 'short' }).format(date)
  const year = date.getFullYear().toString().slice(-2)
  return `${month} '${year}`
}
