import type { ChatThreadDoc, EventDoc, GiftDoc } from '@prezentowo/types'
import { router } from 'expo-router'
import {
  type ReactNode,
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import { useTranslation } from 'react-i18next'
import {
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  Text as RNText,
  TextInput,
  type TextInputProps,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { defaultRules } from 'simple-markdown'
import {
  AttachmentTypePickerButton,
  CameraPickerButton,
  CommandsPickerButton,
  type ComponentOverrides,
  FilePickerButton,
  MediaPickerButton,
  type MessageTextProps,
  PollPickerButton,
  AttachmentPickerSelectionBar as StreamAttachmentPickerSelectionBar,
  MessageComposerLeadingView as StreamMessageComposerLeadingView,
  useAttachmentPickerContext,
  useMessageComposer,
  useStateStore,
  useTheme,
} from 'stream-chat-expo'

import type { ResolvedParticipant } from '@/api/participants'
import {
  MENTION_ICON,
  RENDERED_MENTION,
  insertGiftMention,
  mentionBlocker,
  mentionRanges,
  renderableMentions,
} from '@/chat'
import { Text } from '@/components/ui/text'
import { garland } from '@/constants/colors'
import { PresentTile } from '@/ui/components/PresentTile'

// Present mentions in chat (docs/spec.md §7). Stream reads the overrides once,
// at mount, so they read the event's presents from context.
type ChatPresents = {
  event: EventDoc
  thread: ChatThreadDoc
  // The viewer's own `gifts.byEvent`: only what they may see.
  gifts: GiftDoc[]
  // Whether `gifts` has arrived, so a mention isn't called unavailable
  // while it loads.
  giftsReady: boolean
  // For names.
  participants: ResolvedParticipant[]
}

const ChatPresentsContext = createContext<
  | (ChatPresents & {
      // Whether the picker is open: 🎁 sits in the attachment shelf, which
      // closes as the picker opens, so the picker lives in the composer.
      picking: boolean
      setPicking: (picking: boolean) => void
    })
  | null
>(null)

export function ChatPresentsProvider({
  children,
  ...value
}: ChatPresents & { children: ReactNode }) {
  const [picking, setPicking] = useState(false)
  return (
    <ChatPresentsContext.Provider value={{ ...value, picking, setPicking }}>
      {children}
    </ChatPresentsContext.Provider>
  )
}

const useChatPresents = () => useContext(ChatPresentsContext)

// Stream's buttons, and the picker 🎁 opens.
function MessageComposerLeadingView() {
  const presents = useChatPresents()
  return (
    <>
      <StreamMessageComposerLeadingView />
      {presents ? (
        <MentionPicker
          visible={presents.picking}
          onClose={() => presents.setPicking(false)}
        />
      ) : null}
    </>
  )
}

// 🎁, then the attachment shelf's buttons. 🎁 closes the shelf and opens
// the picker. Stream's own bar, rebuilt (its styles: 12/16 are its
// `spacingSm`/`spacingMd`), since 🎁 beside it lands off its row.
function AttachmentPickerSelectionBar() {
  const { t } = useTranslation()
  const presents = useChatPresents()
  const { closePicker } = useAttachmentPickerContext()
  const { theme } = useTheme()
  if (!presents) return <StreamAttachmentPickerSelectionBar />
  return (
    <View
      style={[
        {
          backgroundColor: theme.semantics.backgroundCoreElevation1,
          paddingBottom: 12,
          paddingHorizontal: 16,
          alignItems: 'center',
          flexDirection: 'row',
        },
        theme.attachmentSelectionBar.container,
      ]}
    >
      <AttachmentTypePickerButton
        // Stream translates it, and leaves a string it doesn't know as is.
        accessibilityLabelKey={t('chat.mention')}
        Icon={MentionIcon}
        onPress={() => {
          closePicker()
          presents.setPicking(true)
        }}
      />
      <MediaPickerButton />
      <CameraPickerButton />
      <FilePickerButton />
      <PollPickerButton />
      <CommandsPickerButton />
    </View>
  )
}

function MentionIcon() {
  return <Text className="text-[20px] leading-[24px]">{MENTION_ICON}</Text>
}

// The event's presents the viewer can see. One that someone in this thread
// mustn't know about warns instead of going in (docs/spec.md §7).
function MentionPicker({
  visible,
  onClose,
}: {
  visible: boolean
  onClose: () => void
}) {
  const { t } = useTranslation()
  const presents = useChatPresents()
  const composer = useMessageComposer()
  if (!presents) return null
  const { event, gifts, thread, participants } = presents
  const nameOf = (participantId: string) =>
    participants.find(p => p.id === participantId)?.name ?? ''

  const pick = (gift: GiftDoc, blocker: string | null) => {
    if (blocker) {
      Alert.alert(
        t('chat.mentionBlockedTitle'),
        t('chat.mentionBlocked', { name: nameOf(blocker) }),
      )
      return
    }
    onClose()
    void insertGiftMention(composer, { giftId: gift._id, title: gift.title })
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView edges={['bottom']} className="flex-1 bg-garland-paper">
        <View className="flex-row items-center justify-between px-[22px] pb-2 pt-5">
          <Text className="text-lg font-bold text-garland-ink">
            {t('chat.mention')}
          </Text>
          <Pressable onPress={onClose} accessibilityRole="button" hitSlop={10}>
            <Text className="text-sm font-semibold text-garland-ink-60">
              {t('chat.mentionClose')}
            </Text>
          </Pressable>
        </View>
        <FlatList
          data={gifts}
          keyExtractor={gift => gift._id}
          ListEmptyComponent={
            <Text className="px-[22px] py-6 text-center text-sm text-garland-ink-60">
              {t('chat.mentionNone')}
            </Text>
          }
          renderItem={({ item: gift }) => {
            const blocker = mentionBlocker(gift, thread, event)
            return (
              <Pressable
                onPress={() => pick(gift, blocker)}
                accessibilityRole="button"
                className="flex-row items-center gap-3.5 border-b border-garland-ink-08 px-[22px] py-3 active:opacity-70"
                style={blocker ? { opacity: 0.45 } : undefined}
              >
                <PresentTile gift={gift} size={44} />
                <View className="min-w-0 flex-1">
                  <Text className="text-[11px] font-semibold text-garland-ink-40">
                    {t('eventDetail.forName', {
                      name: nameOf(gift.forParticipantId),
                    })}
                  </Text>
                  <Text
                    className="text-sm font-bold text-garland-ink"
                    numberOfLines={1}
                  >
                    {gift.title}
                  </Text>
                </View>
              </Pressable>
            )
          }}
        />
      </SafeAreaView>
    </Modal>
  )
}

// A sent message's text, with each mention drawn in place as a tag: the
// present's picture and title from the viewer's own presents, opening `1e`.
// One they can't see (deleted, from another event, or hidden from them)
// shows as unavailable, with no title and no way in. No claims.
function MessageText(props: MessageTextProps) {
  const {
    isMyMessage,
    markdownRules,
    markdownStyles,
    message,
    messageOverlay,
    messageTextNumberOfLines,
    onLongPress,
    onlyEmojis,
    onPress,
    preventPress,
    renderText,
    theme: { theme },
  } = props
  if (!message) return null
  const giftIds = message.giftIds ?? []
  const { onlyEmojiMarkdown } = theme.messageItemView.content.textContainer
  return renderText({
    isMyMessage,
    semantics: theme.semantics,
    markdownRules: giftIds.length
      ? { ...markdownRules, ...mentionRules(giftIds) }
      : markdownRules,
    markdownStyles: {
      ...theme.messageItemView.content.markdown,
      ...markdownStyles,
      ...(onlyEmojis ? onlyEmojiMarkdown : {}),
    },
    message: giftIds.length
      ? { ...message, text: renderableMentions(message.text ?? '') }
      : message,
    messageOverlay,
    messageTextNumberOfLines,
    onLongPress,
    onlyEmojis,
    onPress,
    preventPress,
  })
}

// A markdown rule for the rendered mentions, ahead of plain text.
const mentionRules = (giftIds: string[]) =>
  ({
    giftMention: {
      order: defaultRules.text.order - 0.25,
      match: (source: string) => RENDERED_MENTION.exec(source),
      parse: (capture: string[]) => ({ index: Number(capture[1]) }),
      react: (node: { index: number }, _: unknown, state: { key?: string }) => (
        <MentionTag key={state.key} giftId={giftIds[node.index]} />
      ),
    },
  }) as unknown as MessageTextProps['markdownRules']

// A tag sits in a line of message text (20px). On iOS a taller one only
// grows the line; Android clips the line's descenders instead, so there it
// fits inside the line. Both sit an inline view's bottom on the baseline,
// so it's nudged down onto the text.
const TAG =
  'flex-row items-center gap-1 rounded-full ios:translate-y-1 ios:py-0.5 android:translate-y-1'
const TAG_TILE = Platform.OS === 'android' ? 16 : 20

function MentionTag({ giftId }: { giftId?: string }) {
  const { t } = useTranslation()
  const presents = useChatPresents()
  const gift = presents?.gifts.find(
    g => g._id === giftId && g.eventId === presents.event._id,
  )
  // Not called unavailable while the presents load.
  if (!gift && !presents?.giftsReady) return <Text>{MENTION_ICON}</Text>
  if (!gift) {
    return (
      <View className={`${TAG} bg-garland-ink-08 pl-1 pr-2`}>
        <Text className="text-[13px] opacity-50 android:leading-[18px]">
          {MENTION_ICON}
        </Text>
        <Text className="text-[13px] italic text-garland-ink-60 android:leading-[18px]">
          {t('chat.mentionUnavailable')}
        </Text>
      </View>
    )
  }
  return (
    <Pressable
      onPress={() =>
        router.push({
          pathname: '/event/[eventId]/gift/[giftId]',
          params: { eventId: gift.eventId, giftId: gift._id },
        })
      }
      accessibilityRole="link"
      className={`${TAG} bg-garland-paper2 pl-0.5 pr-2 active:opacity-70`}
    >
      <PresentTile gift={gift} size={TAG_TILE} radius={TAG_TILE / 2} />
      <Text
        className="max-w-[180px] text-[14px] font-bold text-garland-ink android:leading-[18px]"
        numberOfLines={1}
      >
        {gift.title}
      </Text>
    </Pressable>
  )
}

// The composer's text field, with each mention drawn as a tag. The text
// composer keeps mentions whole (`keepMentionsWhole`); when it changes what
// was typed, the caret goes where it says.
export const MentionTextInput = forwardRef<TextInput, TextInputProps>(
  function MentionTextInput({ value = '', onChangeText, ...props }, ref) {
    const composer = useMessageComposer()
    const { picks } = useStateStore(composer.customDataManager.state, s => ({
      picks: s.custom.giftMentions ?? [],
    }))
    const input = useRef<TextInput | null>(null)
    const typed = useRef(value)

    useEffect(() => {
      if (value === typed.current) return
      typed.current = value
      const { start, end } = composer.textComposer.selection
      input.current?.setSelection(start, end)
    }, [value, composer])

    const parts: ReactNode[] = []
    let from = 0
    for (const { start, end } of mentionRanges(value, picks)) {
      parts.push(value.slice(from, start))
      parts.push(
        <RNText key={start} style={styles.mention}>
          {value.slice(start, end)}
        </RNText>,
      )
      from = end
    }
    parts.push(value.slice(from))

    return (
      <TextInput
        {...props}
        ref={node => {
          input.current = node
          if (typeof ref === 'function') ref(node)
          else if (ref) ref.current = node
        }}
        onChangeText={text => {
          typed.current = text
          onChangeText?.(text)
        }}
      >
        {parts}
      </TextInput>
    )
  },
)

const styles = {
  mention: {
    backgroundColor: garland.paper2,
    color: garland.ink,
    fontWeight: '700',
  },
} as const

export const chatPresentOverrides: ComponentOverrides = {
  AttachmentPickerSelectionBar,
  MessageComposerLeadingView,
  MessageText,
}
