import Meteor from '@meteorrn/core'
import Constants from 'expo-constants'
import * as SecureStore from 'expo-secure-store'

import config from '../../config.json'

// In a dev client, `hostUri` is the address the JS bundle was actually loaded
// from (e.g. "192.168.1.177:8081"), so it's guaranteed reachable — unlike a
// hand-maintained IP in config.json, which goes stale whenever the network
// changes. Fall back to config.json for builds with no dev server (e.g. a
// standalone/production build).
const devServerHost = Constants.expoConfig?.hostUri?.split(':')[0]
const backendUrl = devServerHost
  ? `ws://${devServerHost}:8100/websocket`
  : config.backend.url

Meteor.connect(backendUrl, {
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
