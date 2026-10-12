import { Drawer } from 'expo-router/drawer'

import { garland } from '@/constants/colors'
import { useAppBadge } from '@/hooks/useAppBadge'
import { OfflineBanner } from '@/ui/components/OfflineBanner'
import { PushPrePromptSheet } from '@/ui/components/PushPrePromptSheet'
import { AppDrawerContent } from '@/ui/drawer/AppDrawerContent'

// A single drawer screen wrapping the whole authenticated Stack in `(stack)/`,
// so every screen shares one drawer whose menu follows the current route (see
// AppDrawerContent). Screens open it from their own header; edge-swipe stays
// off so it never fights the stack's swipe-back gesture. The offline banner
// sits above it all. The push pre-prompt opens over whichever screen is up.
export default function AppLayout() {
  useAppBadge()
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
      <PushPrePromptSheet />
    </OfflineBanner>
  )
}
