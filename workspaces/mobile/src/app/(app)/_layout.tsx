import { Stack } from 'expo-router'

export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="profile" options={{ animation: 'ios_from_left' }} />
      <Stack.Screen
        name="create-event"
        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="join-event"
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="event/[eventId]"
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen name="person" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="gift" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen
        name="add-gift"
        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
      />
    </Stack>
  )
}
