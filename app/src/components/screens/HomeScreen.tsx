import { Pressable, Text, View } from 'react-native'

import { useAuth } from '@/hooks/useAuth'

export function HomeScreen() {
  const { signOut } = useAuth()

  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Text className="text-2xl font-semibold mb-8">You're logged in!</Text>
      <Pressable
        className="bg-red-500 rounded-lg py-3 px-8"
        onPress={() => signOut({ onError: () => {} })}
      >
        <Text className="text-white text-base font-semibold">Sign out</Text>
      </Pressable>
    </View>
  )
}
