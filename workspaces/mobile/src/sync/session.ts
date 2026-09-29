import { Data, type Ddp, type DdpMessage, meteor } from './meteor'

export type SyncStatus = 'connected' | 'offline'

// `authenticating`: the socket is up, but the library's resume-token login
// (started from its own `connected` handler) hasn't settled. Nothing of ours
// goes out until it has — defect (B).
type Phase = 'offline' | 'authenticating' | 'ready'

type SessionListener = {
  ready?: () => void
  offline?: () => void
  message?: (msg: DdpMessage) => void
}

export type Storage = {
  getItem(key: string): Promise<string | null>
  setItem(key: string, value: string): Promise<void>
  removeItem(key: string): Promise<void>
}

export type ConnectOptions = {
  storage: Storage
  // `null` turns off the library's NetInfo-driven reconnect (tests).
  netInfo?: null
  reconnectIntervalMs?: number
}

let phase: Phase = 'offline'
let current: Ddp | null = null
let installed = false
const statusDep = new meteor.Tracker.Dependency()
const listeners: SessionListener[] = []

export function onSession(listener: SessionListener) {
  listeners.push(listener)
}

export function connect(endpoint: string, options: ConnectOptions) {
  install()
  meteor.connect(endpoint, {
    AsyncStorage: options.storage,
    NetInfo: options.netInfo,
    reconnectInterval: options.reconnectIntervalMs,
  })
}

export function disconnect() {
  meteor.disconnect()
}

// Reactive.
export function status(): SyncStatus {
  statusDep.depend()
  return phase === 'ready' ? 'connected' : 'offline'
}

// The connection, if a message handed to it now would really go out: logged
// in (or known to be logged out) and the socket open, not closing. The library
// silently drops messages sent while closing — defect (A).
export function writableDdp(): Ddp | null {
  if (phase !== 'ready' || !current) return null
  const { status, socket } = current
  if (status !== 'connected' || socket.closing) return null
  return socket.rawSocket?.readyState === 1 ? current : null
}

function setPhase(next: Phase) {
  const wasReady = phase === 'ready'
  phase = next
  if (wasReady !== (next === 'ready')) statusDep.changed()
}

// The library replaces `Data.ddp` with a fresh instance whenever it calls
// `Meteor.connect()` again — its logout does, and so does a resume login the
// server rejects with 403. Follow every instance, not just the first.
function install() {
  if (installed) return
  installed = true

  let ddp = Data.ddp
  Object.defineProperty(Data, 'ddp', {
    configurable: true,
    enumerable: true,
    get: () => ddp,
    set: (next: Ddp | null) => {
      const previous = ddp
      ddp = next
      if (previous) retire(previous)
      if (next) attach(next)
    },
  })
  Data.on('loggingIn', checkLogin)
}

function attach(ddp: Ddp) {
  current = ddp
  const on = (
    event: Parameters<Ddp['on']>[0],
    handle: (m: DdpMessage) => void,
  ) =>
    ddp.on(event, msg => {
      if (current === ddp) handle(msg)
    })

  on('connected', () => {
    setPhase('authenticating')
    // The library's own `connected` listener starts the resume login; it may
    // run after this one, so look once it has.
    setTimeout(checkLogin, 0)
  })
  on('disconnected', () => {
    goOffline()
    abandonLibraryCalls()
  })
  on('ready', emitMessage)
  on('nosub', emitMessage)
}

function retire(ddp: Ddp) {
  if (current === ddp) {
    current = null
    goOffline()
  }
  // The library leaves the old socket open; close it so the server doesn't
  // keep a second session.
  ddp.disconnect()
}

function checkLogin() {
  if (phase !== 'authenticating' || current?.status !== 'connected') return
  if (meteor.loggingIn() === true) return
  setPhase('ready')
  for (const listener of listeners) listener.ready?.()
}

function goOffline() {
  setPhase('offline')
  for (const listener of listeners) listener.offline?.()
}

// The library never settles a call whose connection closed, so its callback
// never runs. For its resume login that's fatal: the callback is what clears
// its "login in flight" flag, and while that's set every later resume login
// returns early — `loggingIn()` stays true and the session never gets ready.
// So answer them once no result can arrive. (Ours are gone already: `calls.ts`
// drops them on `offline`.)
function abandonLibraryCalls() {
  for (const { callback } of Data.calls.splice(0)) {
    callback?.(ABANDONED, undefined)
  }
}

// As `too-many-requests`: the one error the resume login's callback answers by
// just trying the resume again — `timeToReset` + 100 ms later, and only if no
// user is logged in by then. Any other error runs its token-login retry, which
// passes the user id as the token: on a cold start that sends `login` with no
// token, the server rejects it, and the library logs out. The library's other
// calls (its `logout`) ignore the error's shape.
const ABANDONED = {
  error: 'too-many-requests',
  reason: 'The connection closed before a result arrived.',
  timeToReset: 0,
}

function emitMessage(msg: DdpMessage) {
  for (const listener of listeners) listener.message?.(msg)
}
