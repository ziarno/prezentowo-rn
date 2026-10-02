import { Drawer } from 'expo-router/drawer'

import { garland } from '@/constants/colors'
import { OfflineBanner } from '@/ui/components/OfflineBanner'
import { AppDrawerContent } from '@/ui/drawer/AppDrawerContent'

// A single drawer screen wrapping the whole authenticated Stack in `(stack)/`,
// so every screen shares one drawer whose menu follows the current route (see
// AppDrawerContent). Screens open it from their own header; edge-swipe stays
// off so it never fights the stack's swipe-back gesture. The offline banner
// sits above it all.
export default function AppLayout() {
  return (
    <OfflineBanner>
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
    </OfflineBanner>
  )
}
