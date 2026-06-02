import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import en from './locales/en.json'
import pl from './locales/pl.json'

export type SupportedLocale = 'en' | 'pl'

export const LOCALES: { code: SupportedLocale; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'pl', label: 'Polski' },
]

function resolveLocale(): SupportedLocale {
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
}

export default i18n
