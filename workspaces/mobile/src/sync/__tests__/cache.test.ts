/// <reference types="jest" />
import { WebSocket } from 'ws'

import {
  type FakeDdpServer,
  memoryCacheStore,
  memoryStorage,
  startFakeDdpServer,
  waitFor,
} from './support/fakeDdpServer'

type SyncModule = typeof import('../index')
type Doc = { _id: string; [field: string]: unknown }
type Published = { collection: string; id: string; fields: object }

// What the fake server currently publishes. Tests change it between sessions
// to play what happened on the server while the app was away.
let events: Published[]
let gifts: Published[]
const publications = {
  'events.mine': () => events,
  'gifts.byEvent': ([eventId]: unknown[]) =>
    gifts.filter(g => (g.fields as { eventId: string }).eventId === eventId),
}
const event = (id: string): Published => ({
  collection: 'events',
  id,
  fields: { title: id },
})
const gift = (id: string, fields: object): Published => ({
  collection: 'gifts',
  id,
  fields,
})

const key = (name: string, ...params: unknown[]) =>
  JSON.stringify([name, params])
const giftsKey = (eventId: string) => key('gifts.byEvent', eventId)
const eventsKey = key('events.mine')

let server: FakeDdpServer
let sync: SyncModule
let store: ReturnType<typeof memoryCacheStore>
let storage: ReturnType<typeof memoryStorage>

// A fresh copy of the library and the layer, as on an app launch.
function launch() {
  sync?.disconnect()
  jest.resetModules()
  ;(globalThis as { WebSocket?: unknown }).WebSocket = WebSocket
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  sync = require('../index')
  sync.mirror('events.mine', {
    scope: () => ({ events: {} }),
    listsEvents: true,
  })
  sync.mirror('gifts.byEvent', {
    scope: ([eventId]) => ({ gifts: { eventId } }),
    eventId: ([eventId]) => eventId as string,
  })
  sync.connect(server.url, {
    storage,
    cache: store,
    netInfo: null,
    reconnectIntervalMs: 50,
  })
}

const Gifts = () => sync.collection<Doc>('gifts')
const Events = () => sync.collection<Doc>('events')
const ids = (docs: Doc[]) => docs.map(d => d._id).sort()

beforeEach(async () => {
  events = [event('e1')]
  gifts = [gift('g1', { eventId: 'e1', title: 'Socks', link: 'https://x' })]
  server = await startFakeDdpServer({
    tokens: { 'token-1': 'user-1' },
    users: { 'user-1': { profile: { name: 'Ola' } } },
    publications,
  })
  store = memoryCacheStore()
  storage = memoryStorage('token-1')
})

afterEach(async () => {
  sync?.disconnect()
  await server?.close()
})

// A first, online session that leaves `e1`'s gifts and the event list cached.
async function cacheFirstSession() {
  launch()
  await waitFor(() => sync.status() === 'connected')
  const handles = [
    sync.subscribe('events.mine'),
    sync.subscribe('gifts.byEvent', 'e1'),
  ]
  await waitFor(() => handles.every(h => h.ready()))
  await waitFor(() => !!store.snapshot(giftsKey('e1')), {
    label: 'gifts snapshot',
  })
  await waitFor(() => !!store.rows.get('session'), { label: 'session row' })
  return handles
}

describe('mirroring', () => {
  it('stores what a ready subscription received', async () => {
    await cacheFirstSession()

    expect(store.rows.get(giftsKey('e1'))?.eventId).toBe('e1')
    expect(store.snapshot(giftsKey('e1'))).toEqual({
      gifts: [{ _id: 'g1', eventId: 'e1', title: 'Socks', link: 'https://x' }],
    })
  })
})

describe('an offline cold start', () => {
  it('serves the cached data and the signed-in session', async () => {
    await cacheFirstSession()
    server.refuseHandshakes(1000)
    launch()

    await waitFor(() => sync.cacheReady(), { label: 'cache ready' })
    expect(sync.status()).toBe('offline')
    expect(ids(Gifts().find({}).fetch())).toEqual(['g1'])
    expect(sync.isSubscriptionReady('gifts.byEvent', ['e1'])).toBe(true)
    expect(sync.isSubscriptionReady('gifts.byEvent', ['e2'])).toBe(false)
    expect(sync.sessionToken()).toBe('token-1')
    expect(sync.currentUser()).toEqual(
      expect.objectContaining({ _id: 'user-1', profile: { name: 'Ola' } }),
    )
  })

  it('reports a handle ready from the cache', async () => {
    await cacheFirstSession()
    server.refuseHandshakes(1000)
    launch()
    await waitFor(() => sync.cacheReady())

    expect(sync.subscribe('gifts.byEvent', 'e1').ready()).toBe(true)
  })

  it('is signed out without a stored session', async () => {
    server.refuseHandshakes(1000)
    launch()
    await waitFor(() => sync.cacheReady())

    expect(sync.sessionToken()).toBeNull()
    expect(sync.currentUser()).toBeUndefined()
  })
})

describe('reconnecting', () => {
  it('keeps the cached copy visible until the fresh data replaces it', async () => {
    await cacheFirstSession()
    gifts = [gift('g2', { eventId: 'e1', title: 'Scarf' })]
    server.holdMethod('login')
    launch()
    sync.subscribe('gifts.byEvent', 'e1')
    await waitFor(() => server.arrivals(1).includes('login'))

    // Connected, so the library has wiped its collections — the cache is back.
    expect(ids(Gifts().find({}).fetch())).toEqual(['g1'])

    server.releaseMethod('login')
    await waitFor(() => server.arrivals(1).includes('sub:gifts.byEvent'))
    await waitFor(() => ids(Gifts().find({}).fetch()).join() === 'g2', {
      label: 'replaced',
    })
    await waitFor(
      () => store.snapshot(giftsKey('e1'))?.gifts[0]?._id === 'g2',
      { label: 'snapshot replaced' },
    )
    expect(store.snapshot(giftsKey('e1'))?.gifts).toHaveLength(1)
  })

  it('replaces a cached doc instead of merging into it', async () => {
    await cacheFirstSession()
    gifts = [gift('g1', { eventId: 'e1', title: 'Wool socks' })]
    launch()
    const handle = sync.subscribe('gifts.byEvent', 'e1')
    await waitFor(() => sync.status() === 'connected')
    await waitFor(() => Gifts().findOne('g1')?.title === 'Wool socks')

    expect(handle.ready()).toBe(true)
    expect(Gifts().findOne('g1')).not.toHaveProperty('link')
  })

  it('keeps the cache of a subscription not made again', async () => {
    gifts.push(gift('g9', { eventId: 'e2', title: 'Book' }))
    events.push(event('e2'))
    launch()
    await waitFor(() => sync.status() === 'connected')
    const h = [
      sync.subscribe('events.mine'),
      sync.subscribe('gifts.byEvent', 'e2'),
    ]
    await waitFor(() => h.every(x => x.ready()))
    await waitFor(() => !!store.snapshot(giftsKey('e2')))

    launch()
    sync.subscribe('events.mine')
    sync.subscribe('gifts.byEvent', 'e1')
    await waitFor(() => sync.isSubscriptionReady('gifts.byEvent', ['e1']))
    await waitFor(() => server.arrivals(1).includes('sub:gifts.byEvent'))
    await waitFor(() => !!Gifts().findOne('g1'))

    expect(Gifts().findOne('g9')).toEqual(
      expect.objectContaining({ title: 'Book' }),
    )
    expect(store.snapshot(giftsKey('e2'))?.gifts).toHaveLength(1)
  })

  it('wipes events missing from a fresh events.mine', async () => {
    await cacheFirstSession()
    events = []
    gifts = []
    launch()
    expect(sync.cacheReady()).toBe(false)
    await waitFor(() => sync.cacheReady())
    expect(ids(Events().find({}).fetch())).toEqual(['e1'])

    sync.subscribe('events.mine')
    await waitFor(() => Events().find({}).fetch().length === 0, {
      label: 'event gone',
    })
    expect(Gifts().find({}).fetch()).toEqual([])
    await waitFor(() => !store.rows.has(giftsKey('e1')), {
      label: 'gifts snapshot wiped',
    })
    expect(store.snapshot(eventsKey)).toEqual({ events: [] })
    expect(sync.isSubscriptionReady('gifts.byEvent', ['e1'])).toBe(false)
  })
})

describe('signing out', () => {
  it('wipes the cache, the collections and the session', async () => {
    await cacheFirstSession()

    await sync.logout()

    await waitFor(() => store.rows.size === 0, { label: 'store cleared' })
    expect(Gifts().find({}).fetch()).toEqual([])
    expect(Events().find({}).fetch()).toEqual([])
    expect(sync.sessionToken()).toBeNull()

    server.refuseHandshakes(1000)
    launch()
    await waitFor(() => sync.cacheReady())
    expect(Gifts().find({}).fetch()).toEqual([])
    expect(sync.sessionToken()).toBeNull()
  })

  it('caches nothing that comes ready after it', async () => {
    await cacheFirstSession()
    await sync.logout()
    await waitFor(() => store.rows.size === 0)

    const handle = sync.subscribe('gifts.byEvent', 'e2')
    await waitFor(() => server.arrivals(0).includes('sub:gifts.byEvent'))
    await waitFor(() => handle.ready())
    await new Promise(resolve => setTimeout(resolve, 200))

    expect(store.rows.size).toBe(0)
    expect(sync.isSubscriptionReady('gifts.byEvent', ['e2'])).toBe(true)
  })
})
