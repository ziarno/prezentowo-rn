import { router } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { Pressable, View } from 'react-native'

import { cidOf, secretThreadOf, useChatRecap } from '@/chat'
import { ChatIcon } from '@/components/ui/icon'
import { Text } from '@/components/ui/text'
import { garland } from '@/constants/colors'
import { useChatThreads } from '@/hooks/useChatThreads'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useEventParticipants } from '@/hooks/useEventParticipants'
import { useOffline } from '@/hooks/useOffline'
import { usePersonName } from '@/hooks/usePersonName'

// The recap of a person's secret thread (`3f`, `1e`): its last few messages
// and a `💬 Chat` button into `8a`. No composer: messages are only written in
// the thread itself. Renders nothing when the viewer isn't sent the thread —
// it's theirs, or they get no presents here. Until chat has been opened once
// this session only the button shows (docs/spec.md §7).
export function ChatRecapBox({
  eventId,
  participantId,
  label,
  className,
}: {
  eventId: string
  participantId: string
  label: string
  className?: string
}) {
  const { t } = useTranslation()
  const user = useCurrentUser()
  const offline = useOffline()
  const nameOf = usePersonName()
  const { resolveUser } = useEventParticipants(eventId)
  const { threads } = useChatThreads(eventId)
  const thread = secretThreadOf(threads, participantId)
  const recap = useChatRecap(thread && cidOf(thread), user?._id)

  if (!thread) return null

  const open = () =>
    router.push({
      pathname: '/event/[eventId]/person/[participantId]/chat',
      params: { eventId, participantId },
    })

  return (
    <View
      className={`rounded-2xl border border-garland-ink-08 bg-garland-paper2 px-3.5 py-3 ${className ?? ''}`}
    >
      <View className="flex-row items-center gap-3">
        <Text className="flex-1 text-xs leading-[17px] text-garland-ink-60">
          {label}
        </Text>
        {/* Chat is online-only. */}
        <Pressable
          onPress={open}
          disabled={offline}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityState={{ disabled: offline }}
          accessibilityLabel={t('chat.open')}
          className={`flex-row items-center gap-1.5 rounded-full bg-garland-ink px-3 py-1.5 active:opacity-70 ${offline ? 'opacity-40' : ''}`}
        >
          <ChatIcon width={14} height={14} color={garland.paper} />
          <Text className="text-xs font-bold text-garland-paper">
            {t('chat.open')}
          </Text>
        </Pressable>
      </View>

      {recap.status === 'hidden' ? null : (
        <View className="mt-2.5 gap-1.5 border-t border-garland-ink-08 pt-2.5">
          {recap.status === 'loading' ? (
            <Muted>{t('chat.loading')}</Muted>
          ) : recap.status === 'failed' ? (
            <Muted>{t('chat.cantLoad')}</Muted>
          ) : recap.lines.length === 0 ? (
            <Muted>{t('chat.noMessages')}</Muted>
          ) : (
            recap.lines.map(line => (
              <Text
                key={line.id}
                className="text-[13px] leading-[18px] text-garland-ink"
                numberOfLines={2}
              >
                <Text className="font-bold">
                  {nameOf(resolveUser(line.userId))}
                  {': '}
                </Text>
                {line.text ?? t('chat.attachment')}
              </Text>
            ))
          )}
        </View>
      )}
    </View>
  )
}

function Muted({ children }: { children: string }) {
  return (
    <Text className="text-[13px] leading-[18px] text-garland-ink-60">
      {children}
    </Text>
  )
}
