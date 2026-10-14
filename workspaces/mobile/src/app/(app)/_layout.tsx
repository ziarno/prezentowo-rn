import { Stack } from 'expo-router'

import { useAppBadge } from '@/hooks/useAppBadge'
import { OfflineBanner } from '@/ui/components/OfflineBanner'
import { PushPrePromptSheet } from '@/ui/components/PushPrePromptSheet'

// Deep links into an event still land with Home underneath, so back works.
export const unstable_settings = {
  initialRouteName: 'index',
}

const modal = {
  presentation: 'modal',
  animation: 'slide_from_bottom',
} as const

// The authenticated Stack. An event's sections (feed, chat, a person) are one
// screen here, a drawer of their own (`event/[eventId]/(sections)`); what you
// open from them (a present, a person's chat, editing) is pushed over it and
// goes back to it. The offline banner sits above it all. The push pre-prompt
// opens over whichever screen is up.
export default function AppLayout() {
  useAppBadge()
  return (
    <OfflineBanner>
      <Stack
        screenOptions={{ headerShown: false, animation: 'slide_from_right' }}
      >
        <Stack.Screen name="index" />
        {/* Places you visit and leave, not a next step, so no slide. */}
        <Stack.Screen name="profile" options={{ animation: 'none' }} />
        <Stack.Screen name="notifications" options={{ animation: 'none' }} />
        <Stack.Screen name="create-event" options={modal} />
        <Stack.Screen name="delete-account" options={modal} />
        <Stack.Screen name="event/[eventId]/add-gift" options={modal} />
      </Stack>
      <PushPrePromptSheet />
    </OfflineBanner>
  )
}
