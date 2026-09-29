import { useLocalSearchParams } from 'expo-router'

import { AddGiftScreen } from '@/ui/screens/AddGiftScreen'

// `?forParticipantId=` pre-fills the recipient (the list it was opened
// from); `?giftId=` opens the wizard in edit mode on the summary (from `1e`).
export default function AddGiftRoute() {
  const { eventId, forParticipantId, giftId } = useLocalSearchParams<{
    eventId: string
    forParticipantId?: string
    giftId?: string
  }>()
  return (
    <AddGiftScreen
      key={`${eventId}/${giftId ?? ''}`}
      eventId={eventId}
      forParticipantId={forParticipantId}
      giftId={giftId}
    />
  )
}
