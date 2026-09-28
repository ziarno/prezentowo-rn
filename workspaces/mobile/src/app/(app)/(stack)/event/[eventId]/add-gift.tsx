import { useTranslation } from 'react-i18next'

import { StubScreen } from '@/ui/components/StubScreen'

export default function AddGiftRoute() {
  const { t } = useTranslation()
  return <StubScreen title={t('shell.addPresent')} variant="modal" />
}
