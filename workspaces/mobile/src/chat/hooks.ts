import { useFocusEffect } from 'expo-router'
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'

import { chatSession } from './client'
import { RECAP_LENGTH, type RecapLine, recapOf } from './threads'

export function useChatSnapshot() {
  return useSyncExternalStore(chatSession.subscribe, chatSession.snapshot)
}

// Holds the session open while mounted, for a chat screen. `userId: null`
// holds nothing, e.g. while offline.
export function useChatConnection(userId: string | null) {
  useEffect(() => {
    if (!userId) return
    return chatSession.acquire(userId)
  }, [userId])
  return useChatSnapshot()
}

export type ChatRecap =
  // Not connected yet this session: the box shows no messages.
  | { status: 'hidden' }
  | { status: 'loading' }
  | { status: 'loaded'; lines: RecapLine[] }
  | { status: 'failed' }

/**
 * The last few messages of the thread at `cid`, for a recap box (`3f`, `1e`).
 * A plain REST query that neither watches the channel nor opens a socket.
 * Stream's SDK can only make it once a user is set on the client, which only
 * happens when a chat screen connects, so until then the recap stays hidden
 * (docs/spec.md §7 fallback). Fetched again whenever the screen regains focus,
 * e.g. on coming back from that chat.
 */
export function useChatRecap(
  cid: string | undefined,
  viewerId: string | undefined,
): ChatRecap {
  useChatSnapshot()
  const client = viewerId ? chatSession.recapClient(viewerId) : null
  // Tagged with the cid it's for, so a new cid never shows the old recap.
  const [result, setResult] = useState<{ cid: string; recap: ChatRecap }>()

  useFocusEffect(
    useCallback(() => {
      if (!client || !cid || !viewerId) return
      let current = true
      client
        // Not `queryChannels`: that also builds client-side channel state,
        // which the chat screen's own `watch` should own.
        .queryChannelsRequest({ cid: { $in: [cid] } }, [], {
          state: false,
          watch: false,
          message_limit: RECAP_LENGTH,
        })
        .then(
          channels => {
            if (!current) return
            const lines = channels[0] ? recapOf(channels[0]) : []
            setResult({ cid, recap: { status: 'loaded', lines } })
          },
          () => {
            if (current) setResult({ cid, recap: { status: 'failed' } })
          },
        )
      return () => {
        current = false
      }
    }, [client, cid, viewerId]),
  )

  if (!client || !cid) return { status: 'hidden' }
  return result?.cid === cid ? result.recap : { status: 'loading' }
}
