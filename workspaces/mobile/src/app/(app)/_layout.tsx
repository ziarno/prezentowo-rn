import * as Notifications from 'expo-notifications'
import { Stack, router, usePathname } from 'expo-router'
import { useEffect } from 'react'

import { findEventById } from '@/api/events'
import { useAppBadge } from '@/hooks/useAppBadge'
import { takeLastEvent } from '@/store/lastEvent'
import { OfflineBanner } from '@/ui/components/OfflineBanner'
import { PushPrePromptSheet } from '@/ui/components/PushPrePromptSheet'

// Deep links into an event still land with Home underneath, so the drawer's
// "back home" pops to it.
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
  useReopenLastEvent()
  return (
    <OfflineBanner>
      <Stack
        screenOptions={{ headerShown: false, animation: 'slide_from_right' }}
      >
        <Stack.Screen name="index" />
        {/* Places you visit and leave, not a next step, so no slide. */}
        <Stack.Screen name="profile" options={{ animation: 'none' }} />
        <Stack.Screen name="notifications" options={{ animation: 'none' }} />
        {/* Home ⇄ an event cuts straight across; what opens inside it slides.
            No swipe back to Home: only the drawer's "back home" leaves. */}
        <Stack.Screen
          name="event/[eventId]/(sections)"
          options={{ animation: 'none', gestureEnabled: false }}
        />
        <Stack.Screen name="create-event" options={modal} />
        <Stack.Screen name="delete-account" options={modal} />
        <Stack.Screen name="event/[eventId]/add-gift" options={modal} />
      </Stack>
      <PushPrePromptSheet />
    </OfflineBanner>
  )
}

// A cold start that lands on Home reopens the event that was open when the
// app was left, over Home, still behind the splash. Not when the app was
// opened by a link or a push — those go where they point — nor when the
// event is no longer the user's.
function useReopenLastEvent() {
  const pathname = usePathname()
  useEffect(() => {
    // Taken once, so a later navigation doesn't reopen it.
    const eventId = takeLastEvent()
    if (
      !eventId ||
      pathname !== '/' ||
      Notifications.getLastNotificationResponse() ||
      !findEventById(eventId)
    ) {
      return
    }
    router.push({ pathname: '/event/[eventId]', params: { eventId } })
  }, [pathname])
}
