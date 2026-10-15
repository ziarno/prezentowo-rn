import { useLocalSearchParams, useNavigation } from 'expo-router'
import { Drawer } from 'expo-router/drawer'
import { usePreventRemove } from 'expo-router/react-navigation'

import { garland } from '@/constants/colors'
import { EventDrawerContent } from '@/ui/drawer/EventDrawerContent'

// An event's sections, switched from its drawer menu: siblings, so moving
// between them leaves no history. Back never leaves the event: the hardware
// back (once the drawer is closed) is swallowed here and the swipe is off in
// the Stack, so only the drawer's "back home" (`dismissTo`, a POP_TO) or a
// replace gets you out.
export default function EventSectionsLayout() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>()
  const navigation = useNavigation()
  usePreventRemove(true, ({ data }) => {
    if (data.action.type !== 'GO_BACK') navigation.dispatch(data.action)
  })
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
