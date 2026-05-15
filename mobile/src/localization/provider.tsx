import { type Messages, i18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { type ReactNode, useEffect, useState } from 'react'

import { messages as enMessages } from './locales/en/messages'
import { messages as plMessages } from './locales/pl/messages'

type SupportedLocale = 'en' | 'pl'

const catalogs = {
  en: enMessages,
  pl: plMessages,
} satisfies Record<SupportedLocale, Messages>

function resolveLocale(): SupportedLocale {
  const tag = Intl.DateTimeFormat().resolvedOptions().locale ?? 'en-US'
  const code = tag.split('-')[0]?.toLowerCase() ?? 'en'
  return code === 'pl' ? 'pl' : 'en'
}

i18n.loadAndActivate({ locale: 'en', messages: catalogs.en })

const LOCALE_ORDER: SupportedLocale[] = ['en', 'pl']

export function switchLocale() {
  const current = i18n.locale as SupportedLocale
  const next =
    LOCALE_ORDER[(LOCALE_ORDER.indexOf(current) + 1) % LOCALE_ORDER.length]
  i18n.loadAndActivate({ locale: next!, messages: catalogs[next!] })
}

export function LocalizationProvider({ children }: { children: ReactNode }) {
  const [, forceUpdate] = useState(0)

  useEffect(() => {
    const locale = resolveLocale()
    if (i18n.locale !== locale) {
      i18n.loadAndActivate({ locale, messages: catalogs[locale] })
      forceUpdate(n => n + 1)
    }
  }, [])

  return <I18nProvider i18n={i18n}>{children}</I18nProvider>
}
