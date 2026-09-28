import { Drawer } from 'expo-router/drawer'

import { garland } from '@/constants/colors'
import { AppDrawerContent } from '@/ui/drawer/AppDrawerContent'

// A single drawer screen wrapping the whole authenticated Stack in `(stack)/`,
// so every screen shares one drawer whose menu follows the current route (see
// AppDrawerContent). Screens open it from their own header; edge-swipe stays
// off so it never fights the stack's swipe-back gesture.
export default function AppLayout() {
  return (
    <Drawer
      drawerContent={props => <AppDrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        drawerType: 'front',
        swipeEnabled: false,
        drawerStyle: { backgroundColor: garland.paper, width: '82%' },
      }}
    >
      <Drawer.Screen name="(stack)" />
    </Drawer>
  )
}
