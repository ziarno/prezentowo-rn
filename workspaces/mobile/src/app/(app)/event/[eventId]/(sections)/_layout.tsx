import { useLocalSearchParams } from 'expo-router'
import { Drawer } from 'expo-router/drawer'

import { garland } from '@/constants/colors'
import { EventDrawerContent } from '@/ui/drawer/EventDrawerContent'

// An event's sections, switched from its drawer menu: siblings, so moving
// between them leaves no history and back leaves the event. Edge-swipe stays
// off so it never fights the Stack's swipe-back to Home.
export default function EventSectionsLayout() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>()
  return (
    <Drawer
      backBehavior="none"
      drawerContent={props => (
        <EventDrawerContent {...props} eventId={eventId} />
      )}
      screenOptions={{
        headerShown: false,
        drawerType: 'front',
        swipeEnabled: false,
        drawerStyle: { backgroundColor: garland.paper, width: '82%' },
      }}
    >
      <Drawer.Screen name="index" />
      <Drawer.Screen name="chat" />
      <Drawer.Screen name="person/[participantId]" />
    </Drawer>
  )
}
