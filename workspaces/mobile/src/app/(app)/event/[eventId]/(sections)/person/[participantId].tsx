import { useLocalSearchParams } from 'expo-router'

import { PersonPresentsScreen } from '@/ui/screens/PersonPresentsScreen'

export default function PersonRoute() {
  const { eventId, participantId } = useLocalSearchParams<{
    eventId: string
    participantId: string
  }>()
  return (
    // Keyed so moving between people remounts it: its Meteor trackers keep
    // the ids they were first rendered with.
    <PersonPresentsScreen
      key={`${eventId}/${participantId}`}
      eventId={eventId}
      participantId={participantId}
    />
  )
}
