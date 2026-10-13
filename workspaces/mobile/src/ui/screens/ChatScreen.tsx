import type { ChatThreadDoc } from '@prezentowo/types'
import { useFocusEffect } from 'expo-router'
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
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
  WithComponents,
} from 'stream-chat-expo'

import {
  chatI18n,
  chatSession,
  cidOf,
  eventThreadOf,
  secretThreadOf,
  sendWithPushText,
  useChatConnection,
} from '@/chat'
import { Text } from '@/components/ui/text'
import { garland } from '@/constants/colors'
import { useChatThreads } from '@/hooks/useChatThreads'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useEventById } from '@/hooks/useEventById'
import { useEventGifts } from '@/hooks/useEventGifts'
import { useEventParticipants } from '@/hooks/useEventParticipants'
import { useOffline } from '@/hooks/useOffline'
import { showChatOnScreen } from '@/push'
import {
  ChatParticipantsProvider,
  chatAvatarOverrides,
} from '@/ui/components/ChatAvatars'
import {
  ChatPresentsProvider,
  MentionTextInput,
  chatPresentOverrides,
} from '@/ui/components/ChatPresents'
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
  const { event } = useEventById(eventId)
  const { threads, ready } = useChatThreads(eventId)
  const { participants, resolve } = useEventParticipants(eventId)
  // For present mentions: only what the viewer may see (docs/spec.md §7).
  const { gifts, ready: giftsReady } = useEventGifts(eventId)

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
    // Around the whole screen, so the image viewer and the long-press
    // overlay it draws cover our header too.
    <OverlayProvider i18nInstance={chatI18n}>
      <SafeAreaView edges={['top']} className="flex-1 bg-garland-paper">
        <ScreenHeader title={title} />
        <LockNote className="mx-[22px] mb-2">{note}</LockNote>
        {thread && event ? (
          <ChatParticipantsProvider participants={participants}>
            <ChatPresentsProvider
              event={event}
              thread={thread}
              gifts={gifts}
              giftsReady={giftsReady}
              participants={participants}
            >
              <ThreadView thread={thread} />
            </ChatPresentsProvider>
          </ChatParticipantsProvider>
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
    </OverlayProvider>
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
  // How far below the window's top the chat starts, under our header.
  const frame = useRef<View>(null)
  const [top, setTop] = useState(0)

  const cid = cidOf(thread)
  const { streamChannelType: type, streamChannelId: id } = thread
  // Its pushes don't show while it's on screen (docs/spec.md §10.5).
  useFocusEffect(useCallback(() => showChatOnScreen(cid), [cid]))
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
    <View
      ref={frame}
      className="flex-1"
      onLayout={() => frame.current?.measureInWindow((_, y) => setTop(y))}
    >
      <Chat client={client} i18nInstance={chatI18n}>
        <WithComponents overrides={chatOverrides}>
          <Channel
            channel={shown}
            // Both measure from the window's top while the chat starts under
            // our header: without the offset the keyboard covers the
            // composer, and the attachment picker opens below the screen.
            keyboardVerticalOffset={top}
            topInset={top}
            // Its wrapper has no flex of its own, and its content is 100%
            // tall: under our header that pushes the composer off screen.
            additionalKeyboardAvoidingViewProps={{ style: { flex: 1 } }}
            // Voice messages: hold the composer's mic to record (expo-audio).
            audioRecordingEnabled
            // A present mention's titles reach the push, not history.
            doSendMessageRequest={(_, message, options) =>
              sendWithPushText(shown, message, options)
            }
          >
            <MessageList />
            <MessageComposer TextInputComponent={MentionTextInput} />
          </Channel>
        </WithComponents>
      </Chat>
    </View>
  )
}

const chatOverrides = { ...chatAvatarOverrides, ...chatPresentOverrides }

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
