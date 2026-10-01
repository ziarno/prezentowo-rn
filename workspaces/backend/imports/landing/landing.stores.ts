// Where the landing page's store buttons go. The ids match the mobile app's
// app.json (`ios.bundleIdentifier`, `android.package`).

const ANDROID_PACKAGE = 'com.prezentowo.app'

// The numeric App Store id comes with the first App Store Connect
// submission; until then the button falls back to a store search.
export const APP_STORE_URL = 'https://apps.apple.com/search?term=Prezentowo'

/**
 * The Play Store listing. With a `code`, the install referrer carries it, so
 * the app can pick the invite up on first launch (docs/spec.md §3.4).
 */
export const playStoreUrl = (code?: string) =>
  `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}` +
  (code ? `&referrer=${encodeURIComponent(`code=${code}`)}` : '')

export type Platform = 'ios' | 'android' | 'desktop'

// A hint for which store goes first, never a gate: both are always shown.
export function platformOf(userAgent: string | undefined): Platform {
  if (!userAgent) return 'desktop'
  if (/android/i.test(userAgent)) return 'android'
  if (/iphone|ipad|ipod/i.test(userAgent)) return 'ios'
  return 'desktop'
}
