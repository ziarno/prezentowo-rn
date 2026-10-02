// The app's only way to the Meteor backend, and the only importer of
// @meteorrn/core (ESLint enforces it). It fixes the library's reconnect
// defects from #22 — see docs/spec.md §6.1 and ADR 0001.
import type { MeteorError } from '@meteorrn/core'

import { Mongo } from './meteor'

export type { MeteorError }
export {
  authToken,
  completeLogin,
  currentUser,
  findUser,
  loggingIn,
  logout,
  onLogin,
  type LoginResult,
} from './accounts'
export { call, DEFAULT_CALL_TIMEOUT_MS, type CallOptions } from './calls'
export { isNetworkError, NetworkError, type NetworkErrorKind } from './errors'
export {
  useSubscription,
  useSubscriptionPerId,
  useSyncStatus,
  useTracker,
} from './hooks'
export {
  connect,
  disconnect,
  status,
  type ConnectOptions,
  type SyncStatus,
} from './session'
export {
  isSubscriptionReady,
  subscribe,
  type SubscriptionHandle,
} from './subscriptions'

// A client-side view of a published collection.
export function collection<T>(name: string) {
  return new Mongo.Collection<T>(name)
}
