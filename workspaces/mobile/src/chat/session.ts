import type { StreamToken } from '@prezentowo/types'

// The slice of Stream's client the session drives, so tests can stand in
// for it.
export interface ChatClient {
  connectUser(
    user: { id: string },
    tokenProvider: () => Promise<string>,
  ): Promise<unknown>
  openConnection(): Promise<unknown> | undefined
  closeConnection(): Promise<void>
  disconnectUser(): Promise<void>
}

export type ChatStatus = 'idle' | 'connecting' | 'connected' | 'failed'

// `connected` means the user is set on the client. Its socket is open only
// while a chat screen holds the session.
export type ChatSnapshot<C extends ChatClient = ChatClient> = {
  status: ChatStatus
  client: C | null
}

export type ChatSessionDeps<C extends ChatClient> = {
  fetchToken: () => Promise<StreamToken>
  createClient: (apiKey: string) => C
}

/**
 * Stream's client for the signed-in user, connected lazily (docs/spec.md §7):
 * nothing reaches Stream until a chat screen acquires the session, since
 * Stream bills by monthly active users and peak connections. The socket
 * closes when the last chat screen releases it; the user stays set, so recap
 * boxes can still query over plain REST for the rest of the session.
 */
export function createChatSession<C extends ChatClient>({
  fetchToken,
  createClient,
}: ChatSessionDeps<C>) {
  let snapshot: ChatSnapshot<C> = { status: 'idle', client: null }
  let userId: string | null = null
  let holders = 0
  // Bumped whenever the session is torn down, so a connection that lands
  // afterwards is dropped instead of revived.
  let generation = 0
  const listeners = new Set<() => void>()

  const publish = (next: ChatSnapshot<C>) => {
    snapshot = next
    for (const listener of listeners) listener()
  }

  const teardown = () => {
    generation++
    void snapshot.client?.disconnectUser()
    userId = null
    publish({ status: 'idle', client: null })
  }

  const connect = async (forUserId: string) => {
    const attempt = ++generation
    publish({ status: 'connecting', client: null })
    let client: C | null = null
    try {
      const first = await fetchToken()
      if (attempt !== generation) return
      client = createClient(first.apiKey)
      // Stream asks for a token straight away and again whenever it expires.
      let initial: string | null = first.token
      await client.connectUser({ id: forUserId }, async () => {
        if (initial !== null) {
          const token = initial
          initial = null
          return token
        }
        return (await fetchToken()).token
      })
      if (attempt !== generation) {
        void client.disconnectUser()
        return
      }
      publish({ status: 'connected', client })
      if (holders === 0) void client.closeConnection()
    } catch {
      void client?.disconnectUser()
      if (attempt === generation) publish({ status: 'failed', client: null })
    }
  }

  return {
    snapshot: () => snapshot,

    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => void listeners.delete(listener)
    },

    // Held by each open chat screen. Returns its release.
    acquire(forUserId: string) {
      if (userId !== forUserId) {
        if (userId !== null) teardown()
        userId = forUserId
      }
      holders++
      if (snapshot.status === 'idle' || snapshot.status === 'failed') {
        void connect(forUserId)
      } else if (snapshot.status === 'connected' && holders === 1) {
        // The SDK retries the socket itself; a failure shows on the channel.
        void snapshot.client?.openConnection()?.catch(() => {})
      }

      let released = false
      return () => {
        if (released) return
        released = true
        holders--
        if (holders === 0 && snapshot.status === 'connected') {
          void snapshot.client?.closeConnection()
        }
      }
    },

    // Another try after a failure, for the screens still holding the session.
    retry() {
      if (snapshot.status === 'failed' && holders > 0 && userId !== null) {
        void connect(userId)
      }
    },

    // For recap boxes: the client once `forUserId` has connected this
    // session, whether or not a socket is open now. Null before that, which
    // hides the recaps (docs/spec.md §7 fallback).
    recapClient(forUserId: string): C | null {
      return snapshot.status === 'connected' && userId === forUserId
        ? snapshot.client
        : null
    },

    // On sign-out.
    end() {
      holders = 0
      teardown()
    },
  }
}

export type ChatSession<C extends ChatClient = ChatClient> = ReturnType<
  typeof createChatSession<C>
>
