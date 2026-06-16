import { useLocalSearchParams } from 'expo-router'

import { EventDetailScreen } from '@/ui/screens/EventDetailScreen'

export default function EventDetailRoute() {
  const { eventId } = useLocalSearchParams<{ eventId?: string }>()
  return <EventDetailScreen eventId={eventId} />
}
