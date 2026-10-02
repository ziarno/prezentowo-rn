import {
  hasSnapshot,
  keyOf,
  subscriptionReady,
  subscriptionStopped,
} from './cache'
import { type Ddp, meteor } from './meteor'
import { onSession, writableDdp } from './session'

export type SubscriptionHandle = {
  // Reactive. Whether its data is there to show: the server has sent it on
  // this connection, or the offline cache holds a copy. Without a cache,
  // false from every disconnect until the server has re-sent it.
  ready: () => boolean
  stop: () => void
}

type Subscription = {
  name: string
  params: unknown[]
  key: string
  ddpId: string | null
  ready: boolean
}

// The library re-sends only subscriptions made through `Meteor.subscribe`,
// and wipes every collection on reconnect — defect (D). The layer keeps its
// own registry and re-subscribes all of it on each logged-in connection.
const active = new Set<Subscription>()
const changed = new meteor.Tracker.Dependency()

export function subscribe(name: string, ...params: unknown[]) {
  const sub: Subscription = {
    name,
    params,
    key: keyOf(name, params),
    ddpId: null,
    ready: false,
  }
  active.add(sub)
  const ddp = writableDdp()
  if (ddp) start(sub, ddp)

  const handle: SubscriptionHandle = {
    ready: () => {
      changed.depend()
      if (!active.has(sub)) return false
      return sub.ready || hasSnapshot(sub.key)
    },
    stop: () => {
      if (!active.delete(sub)) return
      sub.ready = false
      const ddp = writableDdp()
      if (sub.ddpId && ddp) ddp.unsub(sub.ddpId)
      if (![...active].some(other => other.key === sub.key)) {
        subscriptionStopped(sub.name, sub.params)
      }
      changed.changed()
    },
  }
  return handle
}

// Reactive. Whether any live subscription to `name` with these params is
// ready, or the cache holds its data — lets a hook read readiness before its
// effect has subscribed.
export function isSubscriptionReady(name: string, params: unknown[]) {
  changed.depend()
  const key = keyOf(name, params)
  if (hasSnapshot(key)) return true
  for (const sub of active) if (sub.key === key && sub.ready) return true
  return false
}

function start(sub: Subscription, ddp: Ddp) {
  sub.ddpId = ddp.sub(sub.name, sub.params)
}

onSession({
  ready: () => {
    for (const sub of active) {
      const ddp = writableDdp()
      if (!ddp) return
      start(sub, ddp)
    }
  },
  offline: () => {
    for (const sub of active) {
      sub.ddpId = null
      sub.ready = false
    }
    changed.changed()
  },
  message: msg => {
    if (msg.msg === 'ready') {
      const done = new Set<string>()
      for (const sub of active) {
        if (!sub.ddpId || !msg.subs?.includes(sub.ddpId)) continue
        sub.ready = true
        if (done.has(sub.key)) continue
        done.add(sub.key)
        subscriptionReady(sub.name, sub.params)
      }
      changed.changed()
    } else if (msg.msg === 'nosub') {
      // The server refused or ended it. Report it ready (with no data) so
      // screens don't wait on it forever; it's retried on the next connection.
      for (const sub of active) {
        if (sub.ddpId !== msg.id) continue
        console.warn(`Subscription ${sub.name} ended by the server`, msg.error)
        sub.ddpId = null
        sub.ready = true
      }
      changed.changed()
    }
  },
})
