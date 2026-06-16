import { useLocalSearchParams } from 'expo-router'

import { PersonGiftsScreen } from '@/ui/screens/PersonGiftsScreen'

export default function PersonRoute() {
  const { eventId, participantId } = useLocalSearchParams<{
    eventId?: string
    participantId?: string
  }>()
  return <PersonGiftsScreen eventId={eventId} participantId={participantId} />
}
