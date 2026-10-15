import * as SecureStore from 'expo-secure-store'
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import en from './locales/en.json'
import pl from './locales/pl.json'
// Before `init` below, which is when i18next reads Intl.PluralRules.
import './pluralRules'

export type SupportedLocale = 'en' | 'pl'

export const LOCALES: { code: SupportedLocale; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'pl', label: 'Polski' },
]

// SecureStore key: the language picked on Profile. Read synchronously so the
// first render is already in it; without one the device language decides.
const LOCALE_KEY = 'locale'

function isSupported(value: string | null): value is SupportedLocale {
  return LOCALES.some(l => l.code === value)
}

function savedLocale(): SupportedLocale | null {
  try {
    const value = SecureStore.getItem(LOCALE_KEY)
    return isSupported(value) ? value : null
  } catch {
    return null
  }
}

function resolveLocale(): SupportedLocale {
  const saved = savedLocale()
  if (saved) return saved
  const tag = Intl.DateTimeFormat().resolvedOptions().locale ?? 'en-US'
  const code = tag.split('-')[0]?.toLowerCase() ?? 'en'
  return code === 'pl' ? 'pl' : 'en'
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    pl: { translation: pl },
  },
  lng: resolveLocale(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
})

export function setLocale(locale: SupportedLocale) {
  if (i18n.language === locale) return
  void i18n.changeLanguage(locale)
  void SecureStore.setItemAsync(LOCALE_KEY, locale).catch(() => {})
}

export default i18n
