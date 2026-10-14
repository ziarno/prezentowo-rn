import { useLocalSearchParams } from 'expo-router'

import { EventFeedScreen } from '@/ui/screens/EventFeedScreen'

export default function EventFeedRoute() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>()
  return <EventFeedScreen eventId={eventId} />
}
