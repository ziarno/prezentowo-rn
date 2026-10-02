import * as SecureStore from 'expo-secure-store'

import '@/api/mirrors'
import { BACKEND_WS_URL } from '@/constants/backend'
import { connect, useSyncStatus } from '@/sync'
import { encryptedCacheStore } from '@/sync/encryptedStore'

connect(BACKEND_WS_URL, {
  storage: {
    getItem: SecureStore.getItemAsync,
    setItem: SecureStore.setItemAsync,
    removeItem: SecureStore.deleteItemAsync,
  },
  cache: encryptedCacheStore(),
})

// `connected` once the session can talk to the server: the socket is up and
// the stored login (if any) has been resumed. `offline` otherwise — the app
// then shows what the cache holds.
export const useConnection = () => {
  const status = useSyncStatus()

  return { status }
}
