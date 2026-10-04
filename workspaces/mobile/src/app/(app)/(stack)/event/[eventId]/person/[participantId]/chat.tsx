import { useLocalSearchParams } from 'expo-router'

import { ChatScreen } from '@/ui/screens/ChatScreen'

export default function PersonChatRoute() {
  const { eventId, participantId } = useLocalSearchParams<{
    eventId: string
    participantId: string
  }>()
  return (
    // Keyed so moving between threads remounts it: its Meteor trackers keep
    // the ids they were first rendered with.
    <ChatScreen
      key={`${eventId}/${participantId}`}
      eventId={eventId}
      kind="secret"
      participantId={participantId}
    />
  )
}
