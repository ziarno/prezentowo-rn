import { useTranslation } from 'react-i18next'

import { StubScreen } from '@/ui/components/StubScreen'

export default function EditEventRoute() {
  const { t } = useTranslation()
  return <StubScreen title={t('shell.editEvent')} />
}
