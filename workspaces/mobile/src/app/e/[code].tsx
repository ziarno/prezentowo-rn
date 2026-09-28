import { useTranslation } from 'react-i18next'

import { StubScreen } from '@/ui/components/StubScreen'

export default function InviteRoute() {
  const { t } = useTranslation()
  return <StubScreen title={t('shell.invite')} variant="modal" />
}
