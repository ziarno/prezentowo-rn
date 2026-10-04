import type { ChatThreadDoc } from '@prezentowo/types'
import { type ReactNode, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import type { Channel as StreamChannel } from 'stream-chat'
import {
  Channel,
  Chat,
  MessageComposer,
  MessageList,
  OverlayProvider,
} from 'stream-chat-expo'

import {
  chatI18n,
  chatSession,
  cidOf,
  eventThreadOf,
  secretThreadOf,
  useChatConnection,
} from '@/chat'
import { Text } from '@/components/ui/text'
import { garland } from '@/constants/colors'
import { useChatThreads } from '@/hooks/useChatThreads'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useEventById } from '@/hooks/useEventById'
import { useEventParticipants } from '@/hooks/useEventParticipants'
import { useOffline } from '@/hooks/useOffline'
import { GarlandButton, GarlandButtonText } from '@/ui/components/GarlandButton'
import { LockNote } from '@/ui/components/LockNote'
import { ScreenHeader } from '@/ui/components/ScreenHeader'

// `8b` is the event's thread; `8a` is a person's secret thread, which that
// person is never sent (docs/spec.md §7).
export type ChatScreenProps = { eventId: string } & (
  | { kind: 'event' }
  | { kind: 'secret'; participantId: string }
)

export function ChatScreen(props: ChatScreenProps) {
  const { eventId } = props
  const { t } = useTranslation()
  // For the person's name: participants resolve against the event.
  useEventById(eventId)
  const { threads, ready } = useChatThreads(eventId)
  const { resolve } = useEventParticipants(eventId)

  const person = props.kind === 'secret' ? resolve(props.participantId) : null
  const thread =
    props.kind === 'event'
      ? eventThreadOf(threads)
      : secretThreadOf(threads, props.participantId)

  const title =
    props.kind === 'event'
      ? t('chat.eventTitle')
      : t('chat.personTitle', { name: person?.name ?? '' })
  const note =
    props.kind === 'event'
      ? t('chat.eventNote')
      : t('chat.personNote', { name: person?.name ?? '' })

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-garland-paper">
      <ScreenHeader title={title} />
      <LockNote className="mx-[22px] mb-2">{note}</LockNote>
      {thread ? (
        <ThreadView thread={thread} />
      ) : (
        <Centered>
          {ready ? (
            <Text className="text-center text-sm text-garland-ink-60">
              {t('chat.notFound')}
            </Text>
          ) : (
            <ActivityIndicator color={garland.ink} />
          )}
        </Centered>
      )}
    </SafeAreaView>
  )
}

// Connects to Stream while mounted, then watches the thread's channel.
function ThreadView({ thread }: { thread: ChatThreadDoc }) {
  const user = useCurrentUser()
  const offline = useOffline()
  // Chat is online-only: offline, nothing is attempted.
  const { status, client } = useChatConnection(
    offline ? null : (user?._id ?? null),
  )
  const [channel, setChannel] = useState<{
    cid: string
    channel: StreamChannel | null
  }>()
  const [attempt, setAttempt] = useState(0)

  const cid = cidOf(thread)
  const { streamChannelType: type, streamChannelId: id } = thread
  useEffect(() => {
    if (!client) return
    let current = true
    const next = client.channel(type, id)
    next.watch().then(
      () => current && setChannel({ cid, channel: next }),
      () => current && setChannel({ cid, channel: null }),
    )
    return () => {
      current = false
    }
  }, [client, cid, type, id, attempt])

  const shown = channel?.cid === cid ? channel.channel : undefined
  const retry = () => {
    chatSession.retry()
    setChannel(undefined)
    setAttempt(n => n + 1)
  }

  if (offline || status === 'failed' || shown === null) {
    return <CantLoad onRetry={offline ? undefined : retry} />
  }
  if (!client || !shown) {
    return (
      <Centered>
        <ActivityIndicator color={garland.ink} />
      </Centered>
    )
  }
  return (
    <OverlayProvider i18nInstance={chatI18n}>
      <Chat client={client} i18nInstance={chatI18n}>
        <Channel
          channel={shown}
          // It measures itself within this screen, which starts at the top
          // of the window, so nothing sits above it to offset for.
          keyboardVerticalOffset={0}
          // Its wrapper has no flex of its own, and its content is 100% tall:
          // under our header that pushes the composer off screen.
          additionalKeyboardAvoidingViewProps={{ style: { flex: 1 } }}
        >
          <MessageList />
          <MessageComposer />
        </Channel>
      </Chat>
    </OverlayProvider>
  )
}

// Stream is unreachable (docs/spec.md §7).
function CantLoad({ onRetry }: { onRetry?: () => void }) {
  const { t } = useTranslation()
  return (
    <Centered>
      <Text className="text-center text-sm text-garland-ink-60">
        {t('chat.cantLoad')}
      </Text>
      {onRetry ? (
        <GarlandButton variant="outline" className="mt-5" onPress={onRetry}>
          <GarlandButtonText>{t('chat.retry')}</GarlandButtonText>
        </GarlandButton>
      ) : null}
    </Centered>
  )
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <View className="flex-1 items-center justify-center px-7">{children}</View>
  )
}
