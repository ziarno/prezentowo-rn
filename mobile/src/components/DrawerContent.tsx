import {
  type DrawerContentComponentProps,
  DrawerContentScrollView,
} from '@react-navigation/drawer'
import { useRouter } from 'expo-router'
import { View } from 'react-native'

import { Button, ButtonText } from '@/components/ui/button'
import { VStack } from '@/components/ui/vstack'
import { useAuth } from '@/hooks/useAuth'

export function DrawerContent(props: DrawerContentComponentProps) {
  const router = useRouter()
  const { signOut } = useAuth()

  return (
    <DrawerContentScrollView {...props} contentContainerStyle={{ flex: 1 }}>
      <VStack className="flex-1 p-4" space="sm">
        <Button
          variant="outline"
          action="secondary"
          onPress={() => router.push('/')}
        >
          <ButtonText>Home</ButtonText>
        </Button>

        <Button
          variant="outline"
          action="secondary"
          onPress={() => router.push('/(app)/profile')}
        >
          <ButtonText>Profile</ButtonText>
        </Button>

        <View className="flex-1" />

        <Button
          action="negative"
          onPress={() => signOut({ onError: () => {} })}
        >
          <ButtonText>Log out</ButtonText>
        </Button>
      </VStack>
    </DrawerContentScrollView>
  )
}
