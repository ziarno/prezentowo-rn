import { useTranslation } from 'react-i18next'

import { StubScreen } from '@/ui/components/StubScreen'

export default function PersonRoute() {
  const { t } = useTranslation()
  return <StubScreen title={t('shell.person')} />
}
