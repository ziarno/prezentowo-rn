import { Drawer } from 'expo-router/drawer'

import { DrawerContent } from '@/ui/DrawerContent'

export default function AppLayout() {
  return (
    <Drawer
      drawerContent={props => <DrawerContent {...props} />}
      screenOptions={{ headerShown: true }}
    />
  )
}
