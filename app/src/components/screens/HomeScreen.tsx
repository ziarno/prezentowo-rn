import { View } from 'react-native'

import { Button, ButtonText } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { useAuth } from '@/hooks/useAuth'

export function HomeScreen() {
  const { signOut } = useAuth()

  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Text size="2xl" bold className="mb-8">You're logged in!</Text>
      <Button action="negative" onPress={() => signOut({ onError: () => {} })}>
        <ButtonText>Sign out</ButtonText>
      </Button>
    </View>
  )
}
