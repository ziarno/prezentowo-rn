import { useTranslation } from 'react-i18next'
import { Linking } from 'react-native'

import { type LegalPage, legalPageUrl } from '@/api/profile'

// Opens the privacy policy or terms in the browser, in the app's language.
export function useOpenLegalPage() {
  const { i18n } = useTranslation()
  return (page: LegalPage) =>
    void Linking.openURL(legalPageUrl(page, i18n.language)).catch(() => {})
}
