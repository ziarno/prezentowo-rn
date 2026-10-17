import { useTranslation } from 'react-i18next'
import { Alert, Pressable } from 'react-native'
import {
  type ComponentOverrides,
  type MessageActionsParams,
  type MessageProps,
  Message as StreamMessage,
  messageActions as streamMessageActions,
  useChatContext,
  useStateStore,
} from 'stream-chat-expo'

import { isFromBlockedUser } from '@/chat'
import { Text } from '@/components/ui/text'

// The long-press menu offers Flag Message and Block User on anyone else's
// message (docs/spec.md §7.1). Block User always shows; Flag Message shows
// only when the channel type grants it, so ask for it here: if the grant is
// ever missing the report fails loudly, instead of the action just vanishing.
export const chatMessageActions = (params: MessageActionsParams) =>
  streamMessageActions({
    ...params,
    ownCapabilities: { ...params.ownCapabilities, flagMessage: true },
  })

// `useStateStore` selector: the viewer's blocked user ids, in a fresh object
// each time, which the store compares by value.
const selectBlockedUserIds = (state: { userIds: string[] }) =>
  ({ userIds: state.userIds }) as const

// A message from someone the viewer blocked is replaced by one line, which
// is also the way back: tapping it unblocks. Only the viewer's own screen
// changes; Stream tells the blocked person nothing.
function ChatMessage(props: MessageProps) {
  const { t } = useTranslation()
  const { client } = useChatContext()
  const { userIds } = useStateStore(client.blockedUsers, selectBlockedUserIds)
  const { user } = props.message
  if (!user || !isFromBlockedUser(userIds, props.message)) {
    return <StreamMessage {...props} />
  }
  const name = user.name || user.id
  const unblock = () =>
    Alert.alert(t('chat.unblockTitle', { name }), t('chat.unblockBody'), [
      { text: t('chat.unblockCancel'), style: 'cancel' },
      {
        text: t('chat.unblock'),
        onPress: () => void client.unBlockUser(user.id).catch(() => {}),
      },
    ])
  return (
    <Pressable
      accessibilityRole="button"
      onPress={unblock}
      className="px-4 py-2"
      testID="blocked-message"
    >
      <Text className="text-xs italic text-garland-ink-60">
        {t('chat.blockedHidden', { name })}
      </Text>
    </Pressable>
  )
}

export const chatModerationOverrides: ComponentOverrides = {
  Message: ChatMessage,
}
