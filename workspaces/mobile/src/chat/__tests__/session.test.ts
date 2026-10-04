/// <reference types="jest" />
import type { StreamToken } from '@prezentowo/types'

import { type ChatClient, createChatSession } from '../session'

// Stands in for Stream's client: records what the session asks of it, and
// lets a test decide when (and whether) `connectUser` resolves.
class FakeClient implements ChatClient {
  calls: string[] = []
  tokenProvider: (() => Promise<string>) | null = null
  connected: { resolve: () => void; reject: (e: Error) => void } | null = null

  constructor(readonly apiKey: string) {}

  connectUser(user: { id: string }, provider: () => Promise<string>) {
    this.calls.push(`connectUser ${user.id}`)
    this.tokenProvider = provider
    return new Promise<undefined>((resolve, reject) => {
      this.connected = { resolve: () => resolve(undefined), reject }
    })
  }
  openConnection() {
    this.calls.push('openConnection')
    return Promise.resolve(undefined)
  }
  closeConnection() {
    this.calls.push('closeConnection')
    return Promise.resolve()
  }
  disconnectUser() {
    this.calls.push('disconnectUser')
    return Promise.resolve()
  }
}

const flush = () => new Promise(resolve => setImmediate(resolve))

function setup() {
  let tokens = 0
  const clients: FakeClient[] = []
  const fetchToken = jest.fn(
    async (): Promise<StreamToken> => ({
      apiKey: 'key',
      token: `token${++tokens}`,
    }),
  )
  const session = createChatSession({
    fetchToken,
    createClient: apiKey => {
      const client = new FakeClient(apiKey)
      clients.push(client)
      return client
    },
  })
  // Acquires for `userId` and lets the connection go through.
  const open = async (userId = 'ola') => {
    const release = session.acquire(userId)
    await flush()
    clients.at(-1)!.connected?.resolve()
    await flush()
    return release
  }
  return { session, fetchToken, clients, open }
}

describe('chat session', function () {
  it('connects nobody until a chat screen acquires it', async function () {
    const { session, fetchToken } = setup()
    await flush()

    expect(fetchToken).not.toHaveBeenCalled()
    expect(session.snapshot()).toEqual({ status: 'idle', client: null })
  })

  it("connects the user with the app's key and a token from the server", async function () {
    const { session, clients } = setup()

    session.acquire('ola')
    expect(session.snapshot().status).toBe('connecting')
    await flush()

    expect(clients).toHaveLength(1)
    expect(clients[0].apiKey).toBe('key')
    expect(clients[0].calls).toEqual(['connectUser ola'])

    clients[0].connected!.resolve()
    await flush()
    expect(session.snapshot()).toEqual({
      status: 'connected',
      client: clients[0],
    })
  })

  it('hands Stream the fetched token first, and a fresh one each time after', async function () {
    const { fetchToken, clients, open } = setup()
    await open()
    const provider = clients[0].tokenProvider!

    await expect(provider()).resolves.toBe('token1')
    await expect(provider()).resolves.toBe('token2')
    expect(fetchToken).toHaveBeenCalledTimes(2)
  })

  it('shares one connection between screens open at once', async function () {
    const { session, fetchToken, clients } = setup()

    session.acquire('ola')
    session.acquire('ola')
    await flush()

    expect(fetchToken).toHaveBeenCalledTimes(1)
    expect(clients).toHaveLength(1)
  })

  it('closes the socket when the last chat screen leaves, but keeps the user', async function () {
    const { session, clients, open } = setup()
    const first = await open()
    const second = session.acquire('ola')

    first()
    expect(clients[0].calls).not.toContain('closeConnection')
    second()
    expect(clients[0].calls.at(-1)).toBe('closeConnection')
    expect(session.snapshot()).toEqual({
      status: 'connected',
      client: clients[0],
    })
  })

  it('releases only once per acquire', async function () {
    const { session, clients, open } = setup()
    const first = await open()
    session.acquire('ola')

    first()
    first()
    expect(clients[0].calls).not.toContain('closeConnection')
  })

  it('reopens the socket for the next chat screen without a new token', async function () {
    const { session, fetchToken, clients, open } = setup()
    const release = await open()
    release()

    session.acquire('ola')

    expect(clients[0].calls.at(-1)).toBe('openConnection')
    expect(fetchToken).toHaveBeenCalledTimes(1)
    expect(clients).toHaveLength(1)
  })

  it('closes the socket once connected if every screen left while it was connecting', async function () {
    const { session, clients } = setup()
    const release = session.acquire('ola')
    await flush()
    release()

    clients[0].connected!.resolve()
    await flush()

    expect(clients[0].calls.at(-1)).toBe('closeConnection')
    expect(session.snapshot().status).toBe('connected')
  })

  it('fails when Stream is unreachable, and tries again on the next acquire', async function () {
    const { session, clients } = setup()
    const release = session.acquire('ola')
    await flush()
    clients[0].connected!.reject(new Error('unreachable'))
    await flush()

    expect(session.snapshot()).toEqual({ status: 'failed', client: null })
    expect(clients[0].calls).toContain('disconnectUser')

    release()
    session.acquire('ola')
    await flush()
    expect(clients).toHaveLength(2)
    expect(session.snapshot().status).toBe('connecting')
  })

  it('fails when the token call fails', async function () {
    const { session, fetchToken, clients } = setup()
    fetchToken.mockRejectedValueOnce(new Error('offline'))

    session.acquire('ola')
    await flush()

    expect(clients).toHaveLength(0)
    expect(session.snapshot()).toEqual({ status: 'failed', client: null })
  })

  it('retries a failed connection for the screens still holding it', async function () {
    const { session, fetchToken } = setup()
    fetchToken.mockRejectedValueOnce(new Error('offline'))
    session.acquire('ola')
    await flush()

    session.retry()
    await flush()

    expect(fetchToken).toHaveBeenCalledTimes(2)
    expect(session.snapshot().status).toBe('connecting')
  })

  it('disconnects the previous user before connecting another', async function () {
    const { session, clients, open } = setup()
    const release = await open('ola')
    release()

    await open('bartek')

    expect(clients[0].calls.at(-1)).toBe('disconnectUser')
    expect(clients[1].calls).toEqual(['connectUser bartek'])
    expect(session.snapshot().client).toBe(clients[1])
  })

  it('disconnects on end, and ignores a connection that lands afterwards', async function () {
    const { session, clients, open } = setup()
    await open()
    session.end()
    expect(clients[0].calls.at(-1)).toBe('disconnectUser')
    expect(session.snapshot()).toEqual({ status: 'idle', client: null })

    session.acquire('ola')
    await flush()
    session.end()
    clients[1].connected!.resolve()
    await flush()
    expect(session.snapshot()).toEqual({ status: 'idle', client: null })
  })

  it('tells subscribers when the status changes', async function () {
    const { session, open } = setup()
    const listener = jest.fn()
    const unsubscribe = session.subscribe(listener)

    await open()
    expect(listener).toHaveBeenCalled()

    listener.mockClear()
    unsubscribe()
    session.end()
    expect(listener).not.toHaveBeenCalled()
  })

  describe('recapClient', function () {
    it('is null until the user has connected once this session', async function () {
      const { session, clients, open } = setup()
      expect(session.recapClient('ola')).toBeNull()

      const release = await open()
      release()

      // The socket is closed, but the user stays set for plain REST queries.
      expect(session.recapClient('ola')).toBe(clients[0])
      expect(session.recapClient('bartek')).toBeNull()
    })

    it('is null again once the session ends', async function () {
      const { session, open } = setup()
      await open()
      session.end()

      expect(session.recapClient('ola')).toBeNull()
    })
  })
})
