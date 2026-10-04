import { useLocalSearchParams } from 'expo-router'

import { ChatScreen } from '@/ui/screens/ChatScreen'

export default function EventChatRoute() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>()
  return <ChatScreen key={eventId} eventId={eventId} kind="event" />
}
