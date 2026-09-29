import * as SecureStore from 'expo-secure-store'

import { BACKEND_WS_URL } from '@/constants/backend'
import { connect, useSyncStatus } from '@/sync'

connect(BACKEND_WS_URL, {
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
