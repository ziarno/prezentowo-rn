import { useLocalSearchParams } from 'expo-router'

import { JoinEventScreen } from '@/ui/screens/JoinEventScreen'

export default function JoinEventRoute() {
  // `?preview=signed-out` lets the unauthenticated invite-landing variant be
  // viewed from inside the app while deep-link entry from a signed-out state
  // isn't wired up yet.
  const { eventId, preview } = useLocalSearchParams<{
    eventId?: string
    preview?: string
  }>()
  return (
    <JoinEventScreen signedIn={preview !== 'signed-out'} eventId={eventId} />
  )
}
