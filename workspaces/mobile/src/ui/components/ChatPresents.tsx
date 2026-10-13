import type { ChatThreadDoc, EventDoc, GiftDoc } from '@prezentowo/types'
import { router } from 'expo-router'
import { type ReactNode, createContext, useContext, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, FlatList, Modal, Pressable, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import {
  type ComponentOverrides,
  MessageComposerLeadingView as StreamMessageComposerLeadingView,
  useMessageComposer,
  useMessageContext,
} from 'stream-chat-expo'

import type { ResolvedParticipant } from '@/api/participants'
import { MENTION_TOKEN, insertGiftMention, mentionBlocker } from '@/chat'
import { Text } from '@/components/ui/text'
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

const ChatPresentsContext = createContext<ChatPresents | null>(null)

export function ChatPresentsProvider({
  children,
  ...value
}: ChatPresents & { children: ReactNode }) {
  return (
    <ChatPresentsContext.Provider value={value}>
      {children}
    </ChatPresentsContext.Provider>
  )
}

const useChatPresents = () => useContext(ChatPresentsContext)

// Stream's buttons, then 🎁, which opens the picker.
function MessageComposerLeadingView() {
  const { t } = useTranslation()
  const [picking, setPicking] = useState(false)
  const presents = useChatPresents()
  if (!presents) return <StreamMessageComposerLeadingView />
  return (
    <View className="flex-row items-end">
      <StreamMessageComposerLeadingView />
      <Pressable
        onPress={() => setPicking(true)}
        accessibilityRole="button"
        accessibilityLabel={t('chat.mention')}
        hitSlop={4}
        className="mb-0.5 h-10 w-10 items-center justify-center rounded-full active:opacity-60"
      >
        <Text className="text-[22px]">{MENTION_TOKEN}</Text>
      </Pressable>
      <MentionPicker visible={picking} onClose={() => setPicking(false)} />
    </View>
  )
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

// A sent message's mentions, under its text. Each is drawn from the viewer's
// own presents: one they can't see (deleted, from another event, or hidden
// from them) shows as unavailable, with no title and no way in. No claims.
function MessageContentBottomView() {
  const { message } = useMessageContext()
  const presents = useChatPresents()
  const giftIds = message.giftIds ?? []
  if (!presents || !giftIds.length || message.type === 'deleted') return null
  return (
    <View className="gap-1.5 px-2 pb-2">
      {giftIds.map(giftId => {
        const gift = presents.gifts.find(
          g => g._id === giftId && g.eventId === presents.event._id,
        )
        if (!gift && !presents.giftsReady) return null
        return (
          <MentionChip key={giftId} eventId={presents.event._id} gift={gift} />
        )
      })}
    </View>
  )
}

function MentionChip({ eventId, gift }: { eventId: string; gift?: GiftDoc }) {
  const { t } = useTranslation()
  if (!gift) {
    return (
      <View className="flex-row items-center gap-2 rounded-xl bg-garland-paper2 px-2 py-1.5">
        <View className="h-8 w-8 items-center justify-center rounded-lg bg-garland-ink-08">
          <Text className="text-sm opacity-40">{MENTION_TOKEN}</Text>
        </View>
        <Text className="text-[13px] italic text-garland-ink-40">
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
          params: { eventId, giftId: gift._id },
        })
      }
      accessibilityRole="link"
      className="flex-row items-center gap-2 rounded-xl bg-garland-paper2 px-2 py-1.5 active:opacity-70"
    >
      <PresentTile gift={gift} size={32} radius={8} />
      <Text
        className="flex-shrink text-[13px] font-bold text-garland-ink"
        numberOfLines={1}
      >
        {gift.title}
      </Text>
    </Pressable>
  )
}

export const chatPresentOverrides: ComponentOverrides = {
  MessageComposerLeadingView,
  MessageContentBottomView,
}
