/// <reference types="node" />
import type { AddressInfo } from 'net'
import { WebSocket, WebSocketServer } from 'ws'

import type { CacheRow, CacheStore } from '../../cache'

// A minimal DDP server for driving the real @meteorrn/core client over real
// sockets — the approach #22 used to confirm the reconnect defects.

type DdpMessage = { msg: string; [key: string]: unknown }

export type Connection = {
  index: number
  socket: WebSocket
  userId: string | null
  received: DdpMessage[]
}

type PublishedDoc = { collection: string; id: string; fields: object }

type Options = {
  // Resume tokens the server accepts, mapped to the user they log in.
  tokens?: Record<string, string>
  // Publication name → the docs it sends to a logged-in connection.
  publications?: Record<string, (params: unknown[]) => PublishedDoc[]>
  // User id → the fields of their own `users` doc, sent on login as Meteor's
  // universal publication does.
  users?: Record<string, object>
}

export type FakeDdpServer = {
  url: string
  connections: Connection[]
  // Every message received, in arrival order, tagged with its connection.
  log: { connection: number; msg: DdpMessage }[]
  // Names of methods and subs a connection received, in order ("sub:name").
  arrivals: (connection: number) => string[]
  // Server-side close of every open socket.
  dropAll: () => void
  // Accept the next N sockets but close them before sending `connected`.
  refuseHandshakes: (count: number) => void
  // Receive calls to this method but don't answer them until released.
  holdMethod: (name: string) => void
  releaseMethod: (name: string) => void
  close: () => Promise<void>
}

export async function startFakeDdpServer(
  options: Options = {},
): Promise<FakeDdpServer> {
  const wss = new WebSocketServer({ port: 0 })
  await new Promise<void>(resolve => wss.once('listening', () => resolve()))
  const { port } = wss.address() as AddressInfo

  const connections: Connection[] = []
  const log: FakeDdpServer['log'] = []
  const held = new Map<string, { conn: Connection; msg: DdpMessage }[]>()
  let refusals = 0

  const send = (conn: Connection, msg: object) => {
    if (conn.socket.readyState === WebSocket.OPEN) {
      conn.socket.send(JSON.stringify(msg))
    }
  }

  const handle = (conn: Connection, msg: DdpMessage) => {
    switch (msg.msg) {
      case 'connect':
        if (refusals > 0) {
          refusals -= 1
          conn.socket.close()
          return
        }
        send(conn, { msg: 'connected', session: `session-${conn.index}` })
        return
      case 'ping':
        send(conn, { msg: 'pong', id: msg.id })
        return
      case 'method':
        return handleMethod(conn, msg)
      case 'sub':
        return handleSub(conn, msg)
      case 'unsub':
        send(conn, { msg: 'nosub', id: msg.id })
        return
    }
  }

  const handleMethod = (conn: Connection, msg: DdpMessage) => {
    const method = msg.method as string
    const params = (msg.params as unknown[]) ?? []
    const waiting = held.get(method)
    if (waiting) {
      waiting.push({ conn, msg })
      return
    }

    const reply = (result: { result?: unknown; error?: object }) => {
      send(conn, { msg: 'result', id: msg.id, ...result })
      send(conn, { msg: 'updated', methods: [msg.id] })
    }

    if (method === 'login') {
      const { resume } = (params[0] ?? {}) as { resume?: string }
      const userId = resume ? options.tokens?.[resume] : undefined
      if (!userId) {
        return reply({ error: { error: 403, reason: 'Invalid token' } })
      }
      conn.userId = userId
      const fields = options.users?.[userId]
      if (fields) {
        send(conn, { msg: 'added', collection: 'users', id: userId, fields })
      }
      return reply({ result: { id: userId, token: resume } })
    }
    if (method === 'logout') {
      conn.userId = null
      return reply({})
    }
    if (!conn.userId) {
      return reply({
        error: { error: 'notAuthorized', reason: 'mustBeLoggedIn' },
      })
    }
    reply({ result: { ok: method } })
  }

  const handleSub = (conn: Connection, msg: DdpMessage) => {
    const publish = options.publications?.[msg.name as string]
    if (!publish) {
      send(conn, { msg: 'nosub', id: msg.id, error: { error: 404 } })
      return
    }
    if (conn.userId) {
      for (const doc of publish((msg.params as unknown[]) ?? [])) {
        send(conn, { msg: 'added', ...doc })
      }
    }
    send(conn, { msg: 'ready', subs: [msg.id] })
  }

  wss.on('connection', socket => {
    const conn: Connection = {
      index: connections.length,
      socket,
      userId: null,
      received: [],
    }
    connections.push(conn)
    socket.on('message', data => {
      const msg = JSON.parse(data.toString()) as DdpMessage
      if (msg.msg !== 'ping' && msg.msg !== 'pong') {
        conn.received.push(msg)
        log.push({ connection: conn.index, msg })
      }
      handle(conn, msg)
    })
  })

  return {
    url: `ws://127.0.0.1:${port}/websocket`,
    connections,
    log,
    arrivals: index =>
      (connections[index]?.received ?? [])
        .filter(m => m.msg === 'method' || m.msg === 'sub')
        .map(m => (m.msg === 'sub' ? `sub:${m.name}` : (m.method as string))),
    dropAll: () => {
      for (const conn of connections) conn.socket.terminate()
    },
    refuseHandshakes: count => {
      refusals = count
    },
    holdMethod: name => {
      held.set(name, [])
    },
    releaseMethod: name => {
      const waiting = held.get(name) ?? []
      held.delete(name)
      for (const { conn, msg } of waiting) handleMethod(conn, msg)
    },
    close: () =>
      new Promise(resolve => {
        for (const conn of connections) conn.socket.terminate()
        wss.close(() => resolve())
      }),
  }
}

// Polls until `predicate` holds, failing the test after `timeoutMs`.
export async function waitFor(
  predicate: () => boolean,
  { timeoutMs = 3000, label = 'condition' } = {},
): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error(`Timed out waiting for ${label}`)
    await new Promise(resolve => setTimeout(resolve, 10))
  }
}

// In-memory stand-in for the encrypted SQLite cache. Pass the same one to a
// later `connect` to simulate a cold start.
export function memoryCacheStore() {
  const rows = new Map<string, CacheRow>()
  const store: CacheStore = {
    load: async () => [...rows.values()],
    put: async row => {
      rows.set(row.key, row)
    },
    remove: async (keys: string[]) => {
      for (const key of keys) rows.delete(key)
    },
    clear: async () => {
      rows.clear()
    },
  }
  return {
    ...store,
    rows,
    // The parsed snapshot stored under a subscription key, if any.
    snapshot: (key: string) => {
      const row = rows.get(key)
      return row
        ? (JSON.parse(row.data) as Record<string, { _id: string }[]>)
        : undefined
    },
  }
}

// In-memory stand-in for SecureStore, pre-seeded with a resume token.
export function memoryStorage(token?: string) {
  const items = new Map<string, string>()
  if (token) items.set('reactnativemeteor_usertoken', token)
  return {
    items,
    getItem: async (key: string) => items.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      items.set(key, value)
    },
    removeItem: async (key: string) => {
      items.delete(key)
    },
  }
}
