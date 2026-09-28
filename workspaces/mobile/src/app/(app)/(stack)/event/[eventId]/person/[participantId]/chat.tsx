import { useTranslation } from 'react-i18next'

import { StubScreen } from '@/ui/components/StubScreen'

export default function PersonChatRoute() {
  const { t } = useTranslation()
  return <StubScreen title={t('shell.personChat')} />
}
