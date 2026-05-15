import { useLingui } from '@lingui/react/macro'
import { Drawer } from 'expo-router/drawer'

import { DrawerContent } from '@/ui/DrawerContent'

export default function AppLayout() {
  const { t } = useLingui()

  return (
    <Drawer
      drawerContent={props => <DrawerContent {...props} />}
      screenOptions={{ headerShown: true }}
    >
      <Drawer.Screen
        name="index"
        options={{
          drawerLabel: t`Home`,
          title: t`Home`,
        }}
      />
      <Drawer.Screen
        name="profile"
        options={{
          drawerLabel: t`Profile`,
          title: t`Profile`,
        }}
      />
    </Drawer>
  )
}
