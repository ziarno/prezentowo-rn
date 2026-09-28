import Constants from 'expo-constants'
import * as SecureStore from 'expo-secure-store'

import { connect, useSyncStatus } from '@/sync'

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

connect(backendUrl, {
  storage: {
    getItem: SecureStore.getItemAsync,
    setItem: SecureStore.setItemAsync,
    removeItem: SecureStore.deleteItemAsync,
  },
})

// `connected` once the session can talk to the server: the socket is up and
// the stored login (if any) has been resumed.
export const useConnection = () => {
  const status = useSyncStatus()

  return { status }
}
