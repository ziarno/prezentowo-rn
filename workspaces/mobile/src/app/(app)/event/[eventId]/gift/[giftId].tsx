import { useLocalSearchParams } from 'expo-router'

import { PresentDetailScreen } from '@/ui/screens/PresentDetailScreen'

export default function GiftRoute() {
  const { eventId, giftId } = useLocalSearchParams<{
    eventId: string
    giftId: string
  }>()
  return (
    <PresentDetailScreen
      key={`${eventId}/${giftId}`}
      eventId={eventId}
      giftId={giftId}
    />
  )
}
