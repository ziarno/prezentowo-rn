import type { EventDoc } from '@prezentowo/types'
import { Trans, useTranslation } from 'react-i18next'
import { View } from 'react-native'

import { activityLines } from '@/api/activityFeed'
import { Text } from '@/components/ui/text'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import type { EventParticipantsResult } from '@/hooks/useEventParticipants'
import { usePersonName } from '@/hooks/usePersonName'
import { useRecentActivity } from '@/hooks/useRecentActivity'
import { activityKey, activityTime } from '@/localization/activityText'
import { ActivityKindIcon } from '@/ui/components/ActivityKindIcon'

// The up-to-3 recent items under a `3a` row, one compact line each. Nothing
// at all while the event has none.
export function RecentActivity({
  event,
  resolve,
}: {
  event: EventDoc
  resolve: EventParticipantsResult['resolve']
}) {
  const { t, i18n } = useTranslation()
  const user = useCurrentUser()
  const nameOf = usePersonName()
  const items = useRecentActivity(event._id)
  const now = new Date()

  const lines = activityLines(event, items, user?._id)
  if (lines.length === 0) return null

  return (
    <View className="mt-2 gap-1 border-t border-dashed border-garland-ink-08 pt-2">
      {lines.map(({ item, line }) => {
        const actor = resolve(line.actorId)
        const recipient =
          'recipientId' in line && line.recipientId
            ? resolve(line.recipientId)
            : undefined
        return (
          <View key={item._id} className="flex-row items-start gap-2">
            <View className="mt-[3px]">
              <ActivityKindIcon kind={line.kind} size={12} />
            </View>
            <Text
              className="min-w-0 flex-1 text-[13px] leading-[18px] text-garland-ink"
              numberOfLines={2}
            >
              <Trans
                i18nKey={activityKey(line, 'home', !!actor?.isYou)}
                values={{
                  actor: nameOf(actor),
                  recipient: nameOf(recipient),
                  gift: 'giftTitle' in line ? line.giftTitle : undefined,
                }}
                // Same indices as the feed's keys; Home's names aren't bold.
                components={[
                  <Text key="person" />,
                  <Text key="gift" className="font-bold" />,
                ]}
              />
              <Text className="text-garland-ink-40">
                {`  ${activityTime(t, i18n.language, item.createdAt, now, 'home')}`}
              </Text>
            </Text>
          </View>
        )
      })}
    </View>
  )
}
