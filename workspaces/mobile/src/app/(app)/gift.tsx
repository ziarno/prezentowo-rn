import { useLocalSearchParams } from 'expo-router'

import { GiftDetailScreen } from '@/ui/screens/GiftDetailScreen'

export default function GiftRoute() {
  const { giftId, eventId } = useLocalSearchParams<{
    giftId?: string
    eventId?: string
  }>()
  return <GiftDetailScreen giftId={giftId} eventId={eventId} />
}
