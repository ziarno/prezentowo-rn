import { useLocalSearchParams } from 'expo-router'

import { EditEventScreen } from '@/ui/screens/EditEventScreen'

export default function EditEventRoute() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>()
  return <EditEventScreen eventId={eventId} />
}
