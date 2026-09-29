import Constants from 'expo-constants'

import config from '../../config.json'

// In a dev client, `hostUri` is the address the JS bundle was actually loaded
// from (e.g. "192.168.1.177:8081"), so it's guaranteed reachable — unlike a
// hand-maintained IP in config.json, which goes stale whenever the network
// changes. Fall back to config.json for builds with no dev server (e.g. a
// standalone/production build).
const devServerHost = Constants.expoConfig?.hostUri?.split(':')[0]

// The DDP endpoint.
export const BACKEND_WS_URL = devServerHost
  ? `ws://${devServerHost}:8100/websocket`
  : config.backend.url

// The same server over HTTP, for its Express routes (e.g. `/api/images`).
export const BACKEND_HTTP_URL = BACKEND_WS_URL.replace(/^ws/, 'http').replace(
  /\/websocket$/,
  '',
)
