import Meteor from '@meteorrn/core'
import * as SecureStore from 'expo-secure-store'
import { useEffect, useState } from 'react'

import config from '../../config.json'

export const useConnection = () => {
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    Meteor.connect(config.backend.url, {
      AsyncStorage: {
        getItem: SecureStore.getItemAsync,
        setItem: SecureStore.setItemAsync,
        removeItem: SecureStore.deleteItemAsync,
      },
    })
  }, [])

  Meteor.useTracker(() => {
    setConnected(Meteor.status().connected)
  })

  return { connected }
}
