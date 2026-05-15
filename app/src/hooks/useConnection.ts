import Meteor from '@meteorrn/core'
import * as SecureStore from 'expo-secure-store'

import config from '../../config.json'

Meteor.connect(config.backend.url, {
  AsyncStorage: {
    getItem: SecureStore.getItemAsync,
    setItem: SecureStore.setItemAsync,
    removeItem: SecureStore.deleteItemAsync,
  },
})

export const useConnection = () => {
  const connected = Meteor.useTracker(() => Meteor.status().connected)

  return { connected }
}
