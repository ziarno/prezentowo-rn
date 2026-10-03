/// <reference types="jest" />
import { WebSocket } from 'ws'

import {
  type FakeDdpServer,
  type MethodReply,
  memoryCacheStore,
  memoryQueueStore,
  memoryStorage,
  startFakeDdpServer,
  waitFor,
} from './support/fakeDdpServer'

type SyncModule = typeof import('../index')

let server: FakeDdpServer
let sync: SyncModule
let cache: ReturnType<typeof memoryCacheStore>
let queue: ReturnType<typeof memoryQueueStore>
let storage: ReturnType<typeof memoryStorage>
// How the fake server answers each method; tests change it between sessions.
let methods: Record<string, (params: unknown[]) => MethodReply>
// What a registered `prepare` does to a queued call's args before it's sent.
let prepare: ((args: unknown) => Promise<unknown>) | undefined
// Every `sent` callback for `gifts.add`: its args and the server's result.
let sentAdds: [unknown, unknown][]

// A fresh copy of the library and the layer, as on an app launch.
function launch() {
  sync?.disconnect()
  jest.resetModules()
  ;(globalThis as { WebSocket?: unknown }).WebSocket = WebSocket
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  sync = require('../index')
  sync.queueable('gifts.add', {
    prepare: args => prepare?.(args) ?? args,
    sent: (args, result) => sentAdds.push([args, result]),
  })
  sync.queueable('gifts.claim')
  sync.queueable('gifts.unclaim')
  sync.connect(server.url, {
    storage,
    cache,
    queue,
    netInfo: null,
    reconnectIntervalMs: 50,
  })
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// A launch after the last one quit. An app that quit offline has a reconnect
// timer of the library's still set; let it fire (and be refused) first, or
// the old instance would come back and replay its queue too.
async function relaunch() {
  sync.disconnect()
  await sleep(100)
  launch()
}

const logins = () =>
  server.log.filter(({ msg }) => msg.method === 'login').length

// The methods (not logins) the server received, in arrival order.
const sent = () =>
  server.log
    .filter(({ msg }) => msg.msg === 'method' && msg.method !== 'login')
    .map(({ msg }) => [msg.method, (msg.params as unknown[])[0]])

beforeEach(async () => {
  methods = {}
  prepare = undefined
  sentAdds = []
  server = await startFakeDdpServer({
    tokens: { 'token-1': 'user-1' },
    users: { 'user-1': { profile: { name: 'Ola' } } },
    methods: new Proxy({} as typeof methods, {
      get: (_, name: string) => methods[name],
    }),
  })
  cache = memoryCacheStore()
  queue = memoryQueueStore()
  storage = memoryStorage('token-1')
})

afterEach(async () => {
  sync?.disconnect()
  await server?.close()
})

// A first, online session that leaves the signed-in session cached, then a
// launch that can't reach the server.
async function launchOffline() {
  launch()
  await waitFor(() => sync.status() === 'connected')
  await waitFor(() => !!cache.rows.get('session'), { label: 'session row' })
  server.refuseHandshakes(1_000_000)
  await relaunch()
  await waitFor(() => sync.cacheReady(), { label: 'cache ready' })
}

const comeBackOnline = () => server.refuseHandshakes(0)

describe('offline writes', () => {
  it('queue, then replay in order once back online', async () => {
    await launchOffline()

    await expect(sync.submit('gifts.claim', { giftId: 'g1' })).resolves.toBe(
      'queued',
    )
    await sync.submit('gifts.unclaim', { giftId: 'g2' })
    await sync.submit('gifts.add', { title: 'Socks', clientId: 'c1' })

    expect(sync.queuedWrites()).toEqual([
      expect.objectContaining({ method: 'gifts.claim', state: 'pending' }),
      expect.objectContaining({ method: 'gifts.unclaim', state: 'pending' }),
      expect.objectContaining({ method: 'gifts.add', state: 'pending' }),
    ])
    await sleep(100)
    expect(sent()).toEqual([])

    comeBackOnline()
    await waitFor(() => sync.queuedWrites().length === 0, { label: 'drained' })

    expect(sent()).toEqual([
      ['gifts.claim', { giftId: 'g1' }],
      ['gifts.unclaim', { giftId: 'g2' }],
      ['gifts.add', { title: 'Socks', clientId: 'c1' }],
    ])
    await waitFor(() => queue.rows.size === 0, { label: 'store emptied' })
  })
})

describe('replaying', () => {
  it('waits for the resume login', async () => {
    await launchOffline()
    await sync.submit('gifts.claim', { giftId: 'g1' })
    server.holdMethod('login')
    const before = logins()

    comeBackOnline()
    await waitFor(() => logins() > before)
    await sleep(100)
    expect(sent()).toEqual([])

    server.releaseMethod('login')
    await waitFor(() => sync.queuedWrites().length === 0)
    expect(sent()).toEqual([['gifts.claim', { giftId: 'g1' }]])
  })

  it('survives a cold start', async () => {
    await launchOffline()
    await sync.submit('gifts.claim', { giftId: 'g1' })
    await waitFor(() => queue.rows.size === 1)

    await relaunch()
    await waitFor(() => sync.cacheReady())
    expect(sync.queuedWrites()).toEqual([
      expect.objectContaining({
        method: 'gifts.claim',
        args: { giftId: 'g1' },
        state: 'pending',
        queuedAt: expect.any(Date),
      }),
    ])

    comeBackOnline()
    await waitFor(() => sync.queuedWrites().length === 0)
    expect(sent()).toEqual([['gifts.claim', { giftId: 'g1' }]])
  })
})

const giftGone = () => ({
  error: { error: 'notFound', reason: 'giftNotFound' },
})

describe('a rejected replay', () => {
  it('is kept as failed, with the reason, and the rest still replay', async () => {
    methods['gifts.claim'] = giftGone
    await launchOffline()
    await sync.submit('gifts.claim', { giftId: 'gone' })
    await sync.submit('gifts.unclaim', { giftId: 'g2' })

    comeBackOnline()
    await waitFor(() => sync.queuedWrites().length === 1)

    expect(sync.queuedWrites()).toEqual([
      expect.objectContaining({
        method: 'gifts.claim',
        state: 'failed',
        failure: { error: 'notFound', reason: 'giftNotFound' },
      }),
    ])
    expect(sent()).toEqual([
      ['gifts.claim', { giftId: 'gone' }],
      ['gifts.unclaim', { giftId: 'g2' }],
    ])
  })

  it('stays failed across reconnects and launches, and is never retried', async () => {
    methods['gifts.claim'] = giftGone
    await launchOffline()
    await sync.submit('gifts.claim', { giftId: 'gone' })
    comeBackOnline()
    await waitFor(() => sync.queuedWrites()[0]?.state === 'failed')

    server.dropAll()
    await waitFor(() => sync.status() === 'offline')
    await waitFor(() => sync.status() === 'connected')
    await relaunch()
    await waitFor(() => sync.status() === 'connected')
    await sleep(100)

    expect(sync.queuedWrites()).toEqual([
      expect.objectContaining({ state: 'failed' }),
    ])
    expect(sent()).toHaveLength(1)
  })

  it('goes once discarded', async () => {
    methods['gifts.claim'] = giftGone
    await launchOffline()
    await sync.submit('gifts.claim', { giftId: 'gone' })
    comeBackOnline()
    await waitFor(() => sync.queuedWrites()[0]?.state === 'failed')

    sync.discardWrite(sync.queuedWrites()[0]!.id)

    expect(sync.queuedWrites()).toEqual([])
    await waitFor(() => queue.rows.size === 0, { label: 'store emptied' })
  })
})

describe('prepare', () => {
  it('runs just before the replay, and what it returns is sent', async () => {
    await launchOffline()
    const prepared: unknown[] = []
    prepare = async args => {
      prepared.push(args)
      return { ...(args as object), image: { kind: 'upload', id: 'u1' } }
    }
    await sync.submit('gifts.add', { clientId: 'c1', image: 'file:///p.jpg' })
    expect(prepared).toEqual([])

    comeBackOnline()
    await waitFor(() => sync.queuedWrites().length === 0)

    expect(sent()).toEqual([
      ['gifts.add', { clientId: 'c1', image: { kind: 'upload', id: 'u1' } }],
    ])
  })

  it('keeps the write pending when it fails to reach the server', async () => {
    await launchOffline()
    let attempts = 0
    prepare = async args => {
      attempts += 1
      if (attempts === 1) throw new sync.NetworkError('timeout', 'upload')
      return args
    }
    await sync.submit('gifts.add', { clientId: 'c1' })

    comeBackOnline()
    await waitFor(() => attempts === 1)
    await sleep(50)
    expect(sync.queuedWrites()).toEqual([
      expect.objectContaining({ state: 'pending' }),
    ])
    expect(sent()).toEqual([])

    server.dropAll()
    await waitFor(() => sync.queuedWrites().length === 0, { label: 'retried' })
    expect(sent()).toEqual([['gifts.add', { clientId: 'c1' }]])
  })

  it('fails the write on any other error, without calling the method', async () => {
    await launchOffline()
    prepare = async () => {
      throw Object.assign(new Error('too big'), { code: 'tooLarge' })
    }
    await sync.submit('gifts.add', { clientId: 'c1' })

    comeBackOnline()
    await waitFor(() => sync.queuedWrites()[0]?.state === 'failed')

    expect(sync.queuedWrites()[0]?.failure).toEqual({ error: 'tooLarge' })
    expect(sent()).toEqual([])
  })

  it('stores what it returned, so a later replay doesn’t run it again', async () => {
    await launchOffline()
    prepare = async args => ({ ...(args as object), image: 'uploaded' })
    methods['gifts.add'] = () => ({}) // never answered below
    server.holdMethod('gifts.add')
    await sync.submit('gifts.add', { clientId: 'c1' })

    comeBackOnline()
    await waitFor(() => sent().length === 1)
    await waitFor(() =>
      [...queue.rows.values()].some(r => r.data.includes('uploaded')),
    )
  })
})

describe('online writes', () => {
  async function launchOnline() {
    launch()
    await waitFor(() => sync.status() === 'connected')
  }

  it('are sent straight away', async () => {
    await launchOnline()

    await expect(sync.submit('gifts.claim', { giftId: 'g1' })).resolves.toBe(
      'sent',
    )
    expect(sent()).toEqual([['gifts.claim', { giftId: 'g1' }]])
    expect(sync.queuedWrites()).toEqual([])
  })

  it('run prepare first', async () => {
    await launchOnline()
    prepare = async args => ({ ...(args as object), image: 'uploaded' })

    await sync.submit('gifts.add', { clientId: 'c1' })

    expect(sent()).toEqual([
      ['gifts.add', { clientId: 'c1', image: 'uploaded' }],
    ])
  })

  it('reject with the server’s error, queueing nothing', async () => {
    methods['gifts.claim'] = giftGone
    await launchOnline()

    await expect(sync.submit('gifts.claim', { giftId: 'g1' })).rejects.toEqual(
      expect.objectContaining({ error: 'notFound' }),
    )
    expect(sync.queuedWrites()).toEqual([])
  })

  it('are queued when the connection drops on the way', async () => {
    await launchOnline()
    prepare = async args => ({ ...(args as object), image: 'uploaded' })
    server.holdMethod('gifts.add')

    const result = sync.submit('gifts.add', { clientId: 'c1' })
    await waitFor(() => sent().length === 1)
    server.dropAll()

    await expect(result).resolves.toBe('queued')
    await waitFor(() => sent().length === 2, { label: 'replayed' })
    expect(sent()[1]).toEqual([
      'gifts.add',
      { clientId: 'c1', image: 'uploaded' },
    ])
  })

  it('wait behind writes still queued', async () => {
    await launchOffline()
    await sync.submit('gifts.claim', { giftId: 'g1' })
    server.holdMethod('gifts.claim')
    comeBackOnline()
    await waitFor(() => sent().length === 1, { label: 'claim replaying' })

    await expect(sync.submit('gifts.unclaim', { giftId: 'g1' })).resolves.toBe(
      'queued',
    )
    await sleep(50)
    expect(sent()).toHaveLength(1)

    server.releaseMethod('gifts.claim')
    await waitFor(() => sync.queuedWrites().length === 0)
    expect(sent()).toEqual([
      ['gifts.claim', { giftId: 'g1' }],
      ['gifts.unclaim', { giftId: 'g1' }],
    ])
  })
})

describe('the queue', () => {
  it('is wiped on sign-out', async () => {
    methods['gifts.claim'] = giftGone
    await launchOffline()
    await sync.submit('gifts.claim', { giftId: 'g1' })
    comeBackOnline()
    await waitFor(() => sync.queuedWrites()[0]?.state === 'failed')

    await sync.logout()

    expect(sync.queuedWrites()).toEqual([])
    await waitFor(() => queue.rows.size === 0)
  })

  it('takes only queueable methods', async () => {
    await launchOffline()
    await expect(sync.submit('gifts.remove', { giftId: 'g1' })).rejects.toThrow(
      "gifts.remove can't be queued",
    )
  })
})

describe('sent', () => {
  it('hears the server’s result of a replayed write', async () => {
    methods['gifts.add'] = () => ({ result: { _id: 'g9' } })
    await launchOffline()
    await sync.submit('gifts.add', { clientId: 'c1' })

    comeBackOnline()
    await waitFor(() => sync.queuedWrites().length === 0)

    expect(sentAdds).toEqual([[{ clientId: 'c1' }, { _id: 'g9' }]])
  })
})

describe('meta', () => {
  it('is kept with the write, across launches, and never sent', async () => {
    methods['gifts.claim'] = giftGone
    await launchOffline()
    await sync.submit(
      'gifts.claim',
      { giftId: 'g1' },
      { meta: { title: 'Kindle' } },
    )
    await waitFor(() => queue.rows.size === 1)
    await relaunch()
    comeBackOnline()
    await waitFor(() => sync.queuedWrites()[0]?.state === 'failed')

    expect(sync.queuedWrites()[0]?.meta).toEqual({ title: 'Kindle' })
    expect(sent()).toEqual([['gifts.claim', { giftId: 'g1' }]])
  })

  it('is not sent online either', async () => {
    launch()
    await waitFor(() => sync.status() === 'connected')

    await sync.submit('gifts.claim', { giftId: 'g1' }, { meta: { x: 1 } })

    expect(sent()).toEqual([['gifts.claim', { giftId: 'g1' }]])
  })
})
