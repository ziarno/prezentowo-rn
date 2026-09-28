import { useTranslation } from 'react-i18next'

import { StubScreen } from '@/ui/components/StubScreen'

export default function CreateEventRoute() {
  const { t } = useTranslation()
  return <StubScreen title={t('shell.createEvent')} variant="modal" />
}
