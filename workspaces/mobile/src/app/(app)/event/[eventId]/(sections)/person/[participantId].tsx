import { useLocalSearchParams } from 'expo-router'

import { PersonPresentsScreen } from '@/ui/screens/PersonPresentsScreen'

export default function PersonRoute() {
  const { eventId, participantId, jump } = useLocalSearchParams<{
    eventId: string
    participantId: string
    jump?: string
  }>()
  return (
    // Keyed by event alone: moving between people scrolls the one list.
    // Its Meteor trackers keep the event id they were first rendered with.
    <PersonPresentsScreen
      key={eventId}
      eventId={eventId}
      participantId={participantId}
      jump={jump}
    />
  )
}
