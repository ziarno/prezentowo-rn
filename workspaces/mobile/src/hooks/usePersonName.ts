import { useTranslation } from 'react-i18next'

// How the viewer sees a participant named: "You" for themselves, and
// "Someone" for a user who isn't (or is no longer) in the event.
export function usePersonName() {
  const { t } = useTranslation()
  return (person: { name: string; isYou: boolean } | undefined) =>
    person?.isYou ? t('person.you') : (person?.name ?? t('person.someone'))
}
