import type { ReactNode } from 'react'
import { I18nextProvider } from 'react-i18next'

import i18n from './i18n'

export { LOCALES, setLocale, type SupportedLocale } from './i18n'

export function LocalizationProvider({ children }: { children: ReactNode }) {
  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
}
