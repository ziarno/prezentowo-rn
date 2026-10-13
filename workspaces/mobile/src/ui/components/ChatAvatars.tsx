import { type ReactNode, createContext, useContext } from 'react'
import { View } from 'react-native'
import type { MentionSuggestion, UserResponse } from 'stream-chat'
import {
  type AvatarProps,
  AvatarStack,
  type ComponentOverrides,
  LoadingDots,
  MentionItem,
  type MessageAuthorProps,
  type MessageUserReactionsAvatarProps,
  MentionSuggestionItem as StreamMentionSuggestionItem,
  TokenizedSuggestionParts,
  useChatContext,
  useMessageContext,
  useTheme,
  useThreadContext,
  useTypingContext,
} from 'stream-chat-expo'

import {
  type ResolvedParticipant,
  participantOfStreamUser,
} from '@/api/participants'
import { ParticipantAvatar } from '@/ui/components/ParticipantAvatar'

// Chat draws each person's picture from the event's participants, never from
// Stream, which is sent no `image` (docs/spec.md §2.4, §7). That keeps it
// current with profile changes and the offline cache, with no Stream call.
const ChatParticipants = createContext<ResolvedParticipant[]>([])

export function ChatParticipantsProvider({
  participants,
  children,
}: {
  participants: ResolvedParticipant[]
  children: ReactNode
}) {
  return (
    <ChatParticipants.Provider value={participants}>
      {children}
    </ChatParticipants.Provider>
  )
}

// Stream's avatar sizes, in points.
const STREAM_AVATAR_SIZES: Record<AvatarProps['size'], number> = {
  xs: 20,
  sm: 24,
  md: 32,
  lg: 40,
  xl: 48,
  '2xl': 80,
}

type ChatUserAvatarProps = {
  user: Pick<UserResponse, 'id' | 'name'>
  size: AvatarProps['size']
}

// A real participant shows their profile's picture, a deleted account the
// departed placeholder's (§1.12), and anyone else the initial of the name
// Stream has for them.
function ChatUserAvatar({ user, size }: ChatUserAvatarProps) {
  const participant = participantOfStreamUser(
    useContext(ChatParticipants),
    user.id,
  )
  return (
    <ParticipantAvatar
      name={participant?.name ?? (user.name || user.id)}
      avatarKey={participant?.avatarKey}
      photo={participant?.photo}
      color={participant?.color}
      size={STREAM_AVATAR_SIZES[size]}
    />
  )
}

// Overlapping avatars with a ring, as Stream's `UserAvatarStack` draws them.
function ChatAvatarStack({
  users,
  size,
}: {
  users: UserResponse[]
  size: 'sm' | 'md'
}) {
  const {
    theme: { semantics },
  } = useTheme()
  const items = users.map(user => (
    <View
      key={user.id}
      className="rounded-full border-2"
      style={{ borderColor: semantics.borderCoreInverse }}
    >
      <ChatUserAvatar user={user} size={size} />
    </View>
  ))
  return (
    <AvatarStack avatarSize={size} maxVisible={3} overlap={0.4} items={items} />
  )
}

function MessageAuthor(props: MessageAuthorProps) {
  const context = useMessageContext()
  const {
    lastGroupMessage,
    message,
    showAvatar,
    size = 'md',
  } = {
    ...context,
    ...props,
  }
  const visible =
    typeof showAvatar === 'boolean' ? showAvatar : lastGroupMessage
  return (
    <View testID="message-author">
      {visible && message?.user ? (
        <ChatUserAvatar user={message.user} size={size} />
      ) : (
        // Keeps grouped messages aligned under the avatar column.
        <View
          style={{
            width: STREAM_AVATAR_SIZES[size],
            height: STREAM_AVATAR_SIZES[size],
          }}
        />
      )}
    </View>
  )
}

function MessageRepliesAvatars() {
  const { message } = useMessageContext()
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <ChatAvatarStack users={message.thread_participants ?? []} size="sm" />
    </View>
  )
}

// `reaction.id` is the reacting user's id.
function MessageUserReactionsAvatar({
  reaction,
  size = 'lg',
}: MessageUserReactionsAvatarProps) {
  return (
    <ChatUserAvatar
      user={{ id: reaction.id, name: reaction.name }}
      size={size}
    />
  )
}

// Stream's indicator, with the people typing drawn by `ChatAvatarStack`.
function TypingIndicator() {
  const { client } = useChatContext()
  const { thread } = useThreadContext()
  const { typing } = useTypingContext()
  const {
    theme: { semantics },
  } = useTheme()
  // Others typing here: in this thread, or in the channel outside threads.
  const users = Object.values(typing ?? {}).flatMap(event =>
    event.user &&
    event.user.id !== client.user?.id &&
    (event.parent_id ?? undefined) === (thread?.id ?? undefined)
      ? [event.user]
      : [],
  )
  return (
    <View
      className="flex-row items-center justify-start gap-2"
      testID="typing-indicator"
    >
      <View className="pt-1">
        <ChatAvatarStack users={users} size="md" />
      </View>
      <View
        className="rounded-[20px] rounded-bl-none px-3 py-4"
        style={{ backgroundColor: semantics.chatBgIncoming }}
      >
        <LoadingDots />
      </View>
    </View>
  )
}

// The `@` suggestions: a user row like Stream's, the rest left to Stream.
function MentionSuggestionItem(item: MentionSuggestion) {
  const {
    theme: { semantics },
  } = useTheme()
  if (item.mentionType !== 'user') {
    return <StreamMentionSuggestionItem {...item} />
  }
  return (
    <MentionItem
      leading={
        <View importantForAccessibility="no-hide-descendants">
          <ChatUserAvatar user={item} size="md" />
        </View>
      }
    >
      <TokenizedSuggestionParts
        fallback={item.name || item.id}
        matchStyle={{ fontWeight: '700' }}
        style={{
          color: semantics.textPrimary,
          fontSize: 17,
          lineHeight: 20,
          paddingBottom: 2,
        }}
        testID="mentions-item-name"
        tokenizedDisplayName={item.tokenizedDisplayName}
      />
    </MentionItem>
  )
}

// Every component the chat screen draws a user's picture in. Stream reads
// these once, at mount; each reads the participants from context instead.
export const chatAvatarOverrides: ComponentOverrides = {
  MessageAuthor,
  MessageRepliesAvatars,
  MessageUserReactionsAvatar,
  TypingIndicator,
  MentionSuggestionItem,
}
