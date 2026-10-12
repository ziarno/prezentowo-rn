/// <reference types="jest" />
import { WebSocket } from 'ws'

import {
  type FakeDdpServer,
  memoryStorage,
  startFakeDdpServer,
  waitFor,
} from './support/fakeDdpServer'

type SyncModule = typeof import('../index')

// @meteorrn/core is a module-level singleton, so every test loads a fresh copy
// of it (and of the layer) against its own fake server.
function loadSync(): SyncModule {
  jest.resetModules()
  ;(globalThis as { WebSocket?: unknown }).WebSocket = WebSocket
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('../index')
}

let server: FakeDdpServer
let sync: SyncModule

async function start(
  options: Parameters<typeof startFakeDdpServer>[0] & {
    token?: string
    reconnectIntervalMs?: number
  } = {},
) {
  server = await startFakeDdpServer(options)
  sync = loadSync()
  sync.connect(server.url, {
    storage: memoryStorage(options.token),
    netInfo: null,
    reconnectIntervalMs: options.reconnectIntervalMs ?? 50,
  })
}

afterEach(async () => {
  sync?.disconnect()
  await server?.close()
})

describe('status', () => {
  it('is offline until connected, then connected', async () => {
    await start()
    expect(sync.status()).toBe('offline')
    await waitFor(() => sync.status() === 'connected', { label: 'connected' })
  })

  it('goes offline when the socket drops', async () => {
    await start()
    await waitFor(() => sync.status() === 'connected')
    server.refuseHandshakes(100)
    server.dropAll()
    await waitFor(() => sync.status() === 'offline', { label: 'offline' })
  })

  it('records since when it has been offline', async () => {
    await start()
    expect(sync.offlineSince()).toEqual(expect.any(Number))
    await waitFor(() => sync.status() === 'connected')
    expect(sync.offlineSince()).toBeNull()

    const before = Date.now()
    server.refuseHandshakes(100)
    server.dropAll()
    await waitFor(() => sync.status() === 'offline')
    expect(sync.offlineSince()).toBeGreaterThanOrEqual(before)
  })
})

const withToken = { tokens: { 'token-1': 'user-1' }, token: 'token-1' }
const publications = {
  'gifts.byEvent': ([eventId]: unknown[]) => [
    { collection: 'gifts', id: 'g1', fields: { eventId } },
  ],
}

// The library's shared state, from the same fresh copy the layer loaded.
const library = () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@meteorrn/core').default.getData()

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const methodArrivals = (method: string) =>
  server.log.filter(entry => entry.msg.method === method)

describe('(A) calls survive a closing socket', () => {
  it('retains a call made while the socket is closing and sends it after reconnect', async () => {
    await start(withToken)
    await waitFor(() => sync.status() === 'connected')

    library().ddp.socket.close()
    const result = sync.call('gifts.claim', { giftId: 'g1' })

    await expect(result).resolves.toEqual({ ok: 'gifts.claim' })
    expect(server.arrivals(0)).toEqual(['login'])
    expect(server.arrivals(1)).toEqual(['login', 'gifts.claim'])
  })

  it('retains a call made offline across a failed reconnect', async () => {
    await start(withToken)
    await waitFor(() => sync.status() === 'connected')

    server.refuseHandshakes(1)
    server.dropAll()
    await waitFor(() => sync.status() === 'offline')
    const result = sync.call('gifts.claim', { giftId: 'g1' })

    await expect(result).resolves.toEqual({ ok: 'gifts.claim' })
    expect(server.connections).toHaveLength(3)
    expect(server.arrivals(2)).toEqual(['login', 'gifts.claim'])
    expect(methodArrivals('gifts.claim')).toHaveLength(1)
  })
})

describe('(B) nothing goes out before the resume login completes', () => {
  it('holds calls and subscriptions on a new connection until login resolves', async () => {
    await start({ ...withToken, publications })
    await waitFor(() => sync.status() === 'connected')

    server.holdMethod('login')
    server.dropAll()
    await waitFor(() => server.arrivals(1).includes('login'))
    const result = sync.call('gifts.claim', { giftId: 'g1' })
    sync.subscribe('gifts.byEvent', 'e1')

    await sleep(100)
    expect(server.arrivals(1)).toEqual(['login'])
    expect(sync.status()).toBe('offline')

    server.releaseMethod('login')
    await expect(result).resolves.toEqual({ ok: 'gifts.claim' })
    await waitFor(() => server.arrivals(1).length === 3)
    expect(server.arrivals(1)).toEqual([
      'login',
      'gifts.claim',
      'sub:gifts.byEvent',
    ])
  })
})

describe('(C) every call settles', () => {
  it('defaults to a 15 s timeout', () => {
    sync = loadSync()
    expect(sync.DEFAULT_CALL_TIMEOUT_MS).toBe(15_000)
  })

  it('rejects with a NetworkError when no result arrives in time', async () => {
    await start(withToken)
    await waitFor(() => sync.status() === 'connected')
    server.holdMethod('gifts.claim')

    const error = await sync
      .call('gifts.claim', { giftId: 'g1' }, { timeoutMs: 100 })
      .catch(e => e)

    expect(sync.isNetworkError(error)).toBe(true)
    expect(error.kind).toBe('timeout')
  })

  it('rejects a call made offline once its timeout passes', async () => {
    await start(withToken)
    await waitFor(() => sync.status() === 'connected')
    server.refuseHandshakes(100)
    server.dropAll()
    await waitFor(() => sync.status() === 'offline')

    const error = await sync
      .call('gifts.claim', { giftId: 'g1' }, { timeoutMs: 100 })
      .catch(e => e)

    expect(error).toBeInstanceOf(sync.NetworkError)
    expect(error.kind).toBe('timeout')
    expect(methodArrivals('gifts.claim')).toHaveLength(0)
  })

  it('rejects a sent call when the connection drops before its result', async () => {
    await start(withToken)
    await waitFor(() => sync.status() === 'connected')
    server.holdMethod('gifts.claim')

    const result = sync.call('gifts.claim', { giftId: 'g1' }).catch(e => e)
    await waitFor(() => server.arrivals(0).includes('gifts.claim'))
    server.dropAll()

    const error = await result
    expect(error).toBeInstanceOf(sync.NetworkError)
    expect(error.kind).toBe('disconnected')
    // Not resent: it may already have run.
    await waitFor(() => sync.status() === 'connected')
    expect(server.arrivals(1)).toEqual(['login'])
    // And no longer tracked by the library, which never prunes its calls.
    expect(library().calls).toEqual([])
  })

  it('rejects with the server error when the method fails', async () => {
    await start()
    await waitFor(() => sync.status() === 'connected')

    await expect(sync.call('gifts.claim', { giftId: 'g1' })).rejects.toEqual(
      expect.objectContaining({ error: 'notAuthorized' }),
    )
  })
})

describe('a call settles once its writes are visible', () => {
  const withUser = {
    ...withToken,
    users: { 'user-1': { profile: { name: 'Old' } } },
    methods: {
      'users.update': () => ({
        result: 'saved',
        changed: [
          {
            collection: 'users',
            id: 'user-1',
            fields: { profile: { name: 'New' } },
          },
        ],
      }),
    },
  }
  const name = () =>
    (sync.findUser('user-1') as { profile?: { name?: string } } | undefined)
      ?.profile?.name

  it('resolves with the published change already applied', async () => {
    await start(withUser)
    await waitFor(() => sync.status() === 'connected')
    expect(name()).toBe('Old')

    await expect(sync.call('users.update')).resolves.toBe('saved')
    expect(name()).toBe('New')
  })

  it('does not resolve on the result alone', async () => {
    await start(withUser)
    await waitFor(() => sync.status() === 'connected')
    server.holdUpdated('users.update')

    let settled = false
    const result = sync.call('users.update').finally(() => {
      settled = true
    })
    await waitFor(() => server.arrivals(0).includes('users.update'))
    await sleep(50)
    expect(settled).toBe(false)

    server.releaseUpdated('users.update')
    await expect(result).resolves.toBe('saved')
    expect(name()).toBe('New')
  })

  it('resolves with trackers already re-run on the change', async () => {
    await start(withUser)
    await waitFor(() => sync.status() === 'connected')
    let tracked: string | undefined
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Tracker } = require('@meteorrn/core').default
    const computation = Tracker.autorun(() => {
      tracked = name()
    })
    // The writes and `updated` arrive together, before the library's own
    // flush timer can run.
    server.holdUpdated('users.update')
    const result = sync.call('users.update')
    await waitFor(() => server.arrivals(0).includes('users.update'))
    await sleep(50)
    expect(tracked).toBe('Old')

    server.releaseUpdated('users.update')
    await result
    expect(tracked).toBe('New')
    computation.stop()
  })

  it('also settles when `updated` comes before the result', async () => {
    await start({
      ...withToken,
      methods: {
        'gifts.claim': () => ({ result: 'claimed', updatedFirst: true }),
      },
    })
    await waitFor(() => sync.status() === 'connected')

    await expect(sync.call('gifts.claim')).resolves.toBe('claimed')
  })

  it('rejects with the server error only once `updated` arrives', async () => {
    await start({
      ...withToken,
      methods: { 'gifts.claim': () => ({ error: { error: 'taken' } }) },
    })
    await waitFor(() => sync.status() === 'connected')
    server.holdUpdated('gifts.claim')

    let settled = false
    const result = sync
      .call('gifts.claim')
      .catch(e => e)
      .finally(() => {
        settled = true
      })
    await waitFor(() => server.arrivals(0).includes('gifts.claim'))
    await sleep(50)
    expect(settled).toBe(false)

    server.releaseUpdated('gifts.claim')
    expect(await result).toEqual(expect.objectContaining({ error: 'taken' }))
  })

  it('times out with no result and no `updated`', async () => {
    await start(withUser)
    await waitFor(() => sync.status() === 'connected')
    server.holdMethod('users.update')

    const error = await sync
      .call('users.update', undefined, { timeoutMs: 100 })
      .catch(e => e)

    expect(sync.isNetworkError(error)).toBe(true)
    expect(error.kind).toBe('timeout')
  })

  // The method ran: a NetworkError would have the queue send it again.
  it('settles with the result at the timeout if `updated` never comes', async () => {
    await start(withUser)
    await waitFor(() => sync.status() === 'connected')
    server.holdUpdated('users.update')

    const started = Date.now()
    await expect(
      sync.call('users.update', undefined, { timeoutMs: 150 }),
    ).resolves.toBe('saved')
    expect(Date.now() - started).toBeGreaterThanOrEqual(140)
    expect(name()).toBe('Old')
  })

  it('settles with the result when the connection drops before `updated`', async () => {
    await start(withUser)
    await waitFor(() => sync.status() === 'connected')
    server.holdUpdated('users.update')

    const result = sync.call('users.update').catch(e => e)
    await waitFor(() => server.arrivals(0).includes('users.update'))
    await sleep(50)
    server.dropAll()

    expect(await result).toBe('saved')
    await waitFor(() => sync.status() === 'connected')
    // Not resent.
    expect(server.arrivals(1)).toEqual(['login'])
    expect(library().calls).toEqual([])
  })
})

describe('(D) subscriptions come back after a reconnect', () => {
  it('re-subscribes and is not ready until the data is back', async () => {
    await start({ ...withToken, publications })
    const gifts = sync.collection<{ _id: string; eventId: string }>('gifts')
    const handle = sync.subscribe('gifts.byEvent', 'e1')
    await waitFor(() => handle.ready(), { label: 'first ready' })
    expect(gifts.find({}).fetch()).toEqual([
      expect.objectContaining({ _id: 'g1', eventId: 'e1' }),
    ])

    server.holdMethod('login')
    server.dropAll()
    await waitFor(() => server.arrivals(1).includes('login'))
    // The library has wiped the collection; `ready` says not to trust it.
    expect(gifts.find({}).fetch()).toEqual([])
    expect(handle.ready()).toBe(false)
    expect(sync.isSubscriptionReady('gifts.byEvent', ['e1'])).toBe(false)

    server.releaseMethod('login')
    await waitFor(() => handle.ready(), { label: 'ready again' })
    expect(server.arrivals(1)).toEqual(['login', 'sub:gifts.byEvent'])
    expect(gifts.find({}).fetch()).toEqual([
      expect.objectContaining({ _id: 'g1', eventId: 'e1' }),
    ])
    expect(sync.isSubscriptionReady('gifts.byEvent', ['e1'])).toBe(true)
  })

  it('does not bring back a stopped subscription', async () => {
    await start({ ...withToken, publications })
    const handle = sync.subscribe('gifts.byEvent', 'e1')
    await waitFor(() => handle.ready())
    handle.stop()
    expect(handle.ready()).toBe(false)

    server.dropAll()
    await waitFor(() => server.arrivals(1).includes('login'))
    await waitFor(() => sync.status() === 'connected')
    await sleep(50)
    expect(server.arrivals(1)).toEqual(['login'])
  })
})

describe('a rejected resume token', () => {
  it('follows the library onto its replacement connection', async () => {
    // The library answers a 403 on resume by logging out and calling
    // `Meteor.connect()` again, which swaps in a new DDP instance.
    await start({ token: 'expired-token' })
    const result = sync.call('gifts.claim', { giftId: 'g1' }).catch(e => e)

    await waitFor(() => server.connections.length === 2, {
      label: 'replacement connection',
    })
    await waitFor(() => sync.status() === 'connected')
    expect(server.arrivals(0)).toEqual(['login', 'logout'])
    expect(server.arrivals(1)).toEqual(['gifts.claim'])
    expect(await result).toEqual(
      expect.objectContaining({ error: 'notAuthorized' }),
    )
    // The old socket is closed, not left open beside the new one.
    await waitFor(
      () => server.connections[0].socket.readyState === WebSocket.CLOSED,
      { label: 'old socket closed' },
    )
  })
})

describe('a resume login cut off by a disconnect', () => {
  // The resume token each `login` that reached the server carried.
  const logins = () =>
    methodArrivals('login').map(
      entry => (entry.msg.params as { resume?: string }[])[0]?.resume,
    )

  it('is sent again on the next connection', async () => {
    await start(withToken)
    server.holdMethod('login')
    await waitFor(() => server.arrivals(0).includes('login'))

    server.dropAll()
    await waitFor(() => server.arrivals(1).includes('login'), {
      label: 'login on the next connection',
    })
    server.releaseMethod('login')

    await waitFor(() => sync.status() === 'connected')
    await expect(sync.call('gifts.claim', { giftId: 'g1' })).resolves.toEqual({
      ok: 'gifts.claim',
    })
  })

  it('resumes with the stored token after a slow reconnect', async () => {
    await start({ ...withToken, reconnectIntervalMs: 400 })
    server.holdMethod('login')
    await waitFor(() => server.arrivals(0).includes('login'))

    // The library reconnects at once after the first drop, then waits the
    // reconnect interval — well past its own login retry delays.
    server.refuseHandshakes(1)
    server.dropAll()
    await waitFor(() => server.arrivals(2).includes('login'), {
      label: 'login on the next accepted connection',
    })
    server.releaseMethod('login')

    await waitFor(() => sync.status() === 'connected')
    await expect(sync.call('gifts.claim', { giftId: 'g1' })).resolves.toEqual({
      ok: 'gifts.claim',
    })
    await sleep(300)
    expect(logins()).toEqual(['token-1', 'token-1'])
  })

  it('is sent again mid-session, and nothing retries it after', async () => {
    await start(withToken)
    await waitFor(() => sync.status() === 'connected')

    server.holdMethod('login')
    server.dropAll()
    await waitFor(() => server.arrivals(1).includes('login'))
    server.dropAll()
    await waitFor(() => server.arrivals(2).includes('login'), {
      label: 'login on the next connection',
    })
    server.releaseMethod('login')

    await waitFor(() => sync.status() === 'connected')
    await sleep(300)
    expect(logins()).toEqual(['token-1', 'token-1', 'token-1'])
    expect(server.arrivals(2)).toEqual(['login'])
  })
})
