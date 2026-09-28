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
      <Stack.Screen name="create-event" options={modal} />
      <Stack.Screen name="event/[eventId]/add-gift" options={modal} />
    </Stack>
  )
}
