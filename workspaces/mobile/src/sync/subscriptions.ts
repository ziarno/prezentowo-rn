import { type Ddp, meteor } from './meteor'
import { onSession, writableDdp } from './session'

export type SubscriptionHandle = {
  // Reactive. False from every disconnect until the server has re-sent the
  // subscription's data on the next connection.
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

const keyOf = (name: string, params: unknown[]) =>
  JSON.stringify([name, params])

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
      return sub.ready
    },
    stop: () => {
      if (!active.delete(sub)) return
      sub.ready = false
      const ddp = writableDdp()
      if (sub.ddpId && ddp) ddp.unsub(sub.ddpId)
      changed.changed()
    },
  }
  return handle
}

// Reactive. Whether any live subscription to `name` with these params is
// ready — lets a hook read readiness before its effect has subscribed.
export function isSubscriptionReady(name: string, params: unknown[]) {
  changed.depend()
  const key = keyOf(name, params)
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
      for (const sub of active) {
        if (sub.ddpId && msg.subs?.includes(sub.ddpId)) sub.ready = true
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
