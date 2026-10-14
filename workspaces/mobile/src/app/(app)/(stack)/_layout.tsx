import { Stack } from 'expo-router'

// Deep links into an event still land with Home underneath, so back works.
export const unstable_settings = {
  initialRouteName: 'index',
}

const modal = {
  presentation: 'modal',
  animation: 'slide_from_bottom',
} as const

export default function StackLayout() {
  return (
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
  )
}
