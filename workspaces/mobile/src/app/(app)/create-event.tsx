import { useLocalSearchParams } from 'expo-router'

import { parseStep } from '@/api/eventWizard'
import { CreateEventScreen } from '@/ui/screens/CreateEventScreen'

// `?eventId=` opens the wizard in edit mode (from `6a`); `?step=` picks the
// step it starts at.
export default function CreateEventRoute() {
  const { eventId, step } = useLocalSearchParams<{
    eventId?: string
    step?: string
  }>()
  return (
    <CreateEventScreen
      eventId={eventId}
      start={parseStep(step, eventId ? 'edit' : 'create')}
    />
  )
}
