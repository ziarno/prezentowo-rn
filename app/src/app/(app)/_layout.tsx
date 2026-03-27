import { Drawer } from 'expo-router/drawer'

import { DrawerContent } from '@/components/DrawerContent'

export default function AppLayout() {
  return (
    <Drawer
      drawerContent={props => <DrawerContent {...props} />}
      screenOptions={{ headerShown: true }}
    />
  )
}
