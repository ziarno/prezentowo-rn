import type { GiftDoc } from '@prezentowo/types'
import { Trans, useTranslation } from 'react-i18next'
import { Pressable, View } from 'react-native'

import type { ActivityLine } from '@/api/activityFeed'
import type { ResolvedParticipant } from '@/api/participants'
import { Text } from '@/components/ui/text'
import { usePersonName } from '@/hooks/usePersonName'
import { activityKey, activityTime } from '@/localization/activityText'
import { ActivityKindBadge } from '@/ui/components/ActivityKindIcon'
import { ParticipantAvatar } from '@/ui/components/ParticipantAvatar'
import { PresentTile } from '@/ui/components/PresentTile'

// One `3c`–`3c4` card: who did it (badged with the kind of item), what, the
// present it was about, and when.
// A self-added present is named in the sentence.
export function ActivityFeedItem({
  line,
  createdAt,
  now,
  actor,
  recipient,
  gift,
  onPress,
}: {
  line: ActivityLine
  createdAt: Date
  now: Date
  // Undefined once the actor has left the event: "Someone".
  actor: ResolvedParticipant | undefined
  recipient: ResolvedParticipant | undefined
  // The present as it is now, for its image; undefined when the viewer
  // hasn't got it.
  gift: GiftDoc | undefined
  onPress?: () => void
}) {
  const { t, i18n } = useTranslation()
  const nameOf = usePersonName()
  const actorName = nameOf(actor)
  const giftTitle = 'giftTitle' in line ? line.giftTitle : undefined
  // A suggestion or a claim shows its present on a row of its own.
  const giftRow =
    'giftId' in line && line.kind !== 'self-added' ? line : undefined

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      className="flex-row items-start gap-3 rounded-2xl border border-garland-ink-08 bg-garland-paper px-3.5 py-3 active:opacity-70"
    >
      <View>
        <ParticipantAvatar
          // Their own initial, not "You"'s.
          name={actor?.name ?? actorName}
          avatarKey={actor?.avatarKey}
          color={actor?.color}
          size={32}
        />
        <ActivityKindBadge kind={line.kind} />
      </View>
      <View className="min-w-0 flex-1 gap-1">
        <Text className="text-sm leading-[19px] text-garland-ink">
          <Trans
            i18nKey={activityKey(line, 'feed', !!actor?.isYou)}
            values={{
              actor: actorName,
              recipient: nameOf(recipient),
              gift: giftTitle,
            }}
            components={[
              <Text key="person" className="font-bold" />,
              <Text key="gift" className="font-bold" />,
            ]}
          />
        </Text>
        {giftRow ? (
          <View className="flex-row items-center gap-2">
            <PresentTile
              gift={{ _id: giftRow.giftId, image: gift?.image }}
              size={30}
              radius={8}
            />
            <Text
              className="min-w-0 flex-1 text-sm text-garland-ink"
              numberOfLines={1}
            >
              {giftRow.giftTitle}
            </Text>
          </View>
        ) : null}
        <Text className="text-xs text-garland-ink-60">
          {activityTime(t, i18n.language, createdAt, now, 'feed')}
        </Text>
      </View>
    </Pressable>
  )
}
