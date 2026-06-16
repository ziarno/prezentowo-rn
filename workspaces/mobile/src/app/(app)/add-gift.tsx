import { useLocalSearchParams } from 'expo-router'

import { AddGiftScreen } from '@/ui/screens/AddGiftScreen'

export default function AddGiftRoute() {
  const { eventId, forParticipantId, giftId } = useLocalSearchParams<{
    eventId?: string
    forParticipantId?: string
    giftId?: string
  }>()
  return (
    <AddGiftScreen
      eventId={eventId}
      forParticipantId={forParticipantId}
      giftId={giftId}
    />
  )
}
