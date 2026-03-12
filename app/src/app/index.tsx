import { Pressable, StyleSheet, Text, View } from 'react-native'

import { useAuth } from '@/hooks/useAuth'

export default function HomeScreen() {
  const { authContext } = useAuth()

  return (
    <View style={styles.container}>
      <Text style={styles.title}>You're logged in!</Text>
      <Pressable
        style={styles.button}
        onPress={() => authContext.signOut({ onError: () => {} })}
      >
        <Text style={styles.buttonText}>Sign out</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 32,
  },
  button: {
    backgroundColor: '#e53e3e',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 32,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
})
