import Meteor from '@meteorrn/core'
import * as SecureStore from 'expo-secure-store'
import { useState } from 'react'

import config from '../../config.json'

Meteor.connect(config.backend.url, {
  AsyncStorage: {
    getItem: SecureStore.getItemAsync,
    setItem: SecureStore.setItemAsync,
    removeItem: SecureStore.deleteItemAsync,
  },
})

export const useConnection = () => {
  const [connected, setConnected] = useState(false)

  Meteor.useTracker(() => {
    setConnected(Meteor.status().connected)
  })

  return { connected }
}
