import React from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'

import { useConnection } from '@/hooks/useConnection'

export default function App() {
  const { connected } = useConnection()

  if (!connected) {
    return (
      <View style={styles.container}>
        <ActivityIndicator />
        <Text>Connecting to our servers...</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Text>We are connected!</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#efefef',
    alignItems: 'center',
    justifyContent: 'center',
  },
})
