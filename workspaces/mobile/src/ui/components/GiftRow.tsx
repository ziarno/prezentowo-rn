import type { GiftDoc } from '@prezentowo/types'
import { useTranslation } from 'react-i18next'
import { Pressable, View } from 'react-native'

import { Text } from '@/components/ui/text'
import { GiftFlag } from '@/ui/components/GiftFlag'
import { ParticipantAvatar } from '@/ui/components/ParticipantAvatar'
import { PresentTile } from '@/ui/components/PresentTile'

export type GiftClaimer = { name: string; avatarKey?: string }

type GiftRowProps = {
  gift: GiftDoc
  onPress?: () => void
  // Shown as a small "For …" eyebrow above the title (event-wide list).
  forName?: string
  // Shown under the title instead of the eyebrow (single-person list).
  showDescription?: boolean
  // Resolved claimers, rendered as a small avatar stack on the right.
  claimers?: GiftClaimer[]
  topBorder?: boolean
}

export function GiftRow({
  gift,
  onPress,
  forName,
  showDescription = false,
  claimers = [],
  topBorder = false,
}: GiftRowProps) {
  const { t } = useTranslation()
  const claimedCount = gift.claimedBy?.length ?? 0

  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center gap-3.5 px-[22px] py-3.5 active:opacity-70 ${
        topBorder
          ? 'border-t border-garland-ink-08'
          : 'border-b border-garland-ink-08'
      }`}
    >
      <PresentTile
        // Uploaded photos aren't rendered yet; they fall back to stock art.
        image={gift.image?.kind === 'illustration' ? gift.image.id : undefined}
        size={56}
        imageSize={50}
      />

      <View className="min-w-0 flex-1">
        {forName ? (
          <Text className="text-[11px] font-semibold text-garland-ink-40">
            {t('eventDetail.forName', { name: forName })}
          </Text>
        ) : null}
        <Text
          className="text-sm font-bold leading-[18px] text-garland-ink"
          numberOfLines={1}
        >
          {gift.title}
        </Text>
        {showDescription && gift.description ? (
          <Text
            className="mt-0.5 text-xs text-garland-ink-60"
            numberOfLines={1}
          >
            {gift.description}
          </Text>
        ) : null}
        <View className="mt-1.5 flex-row items-center gap-3">
          <GiftFlag claimed={claimedCount > 0} claimers={claimedCount} />
        </View>
      </View>

      {claimers.length > 0 ? (
        <View className="flex-row">
          {claimers.slice(0, 3).map((c, i) => (
            <View
              key={i}
              style={{ marginLeft: i === 0 ? 0 : -8 }}
              className="rounded-full border-2 border-garland-paper"
            >
              <ParticipantAvatar
                name={c.name}
                avatarKey={c.avatarKey}
                size={22}
              />
            </View>
          ))}
        </View>
      ) : null}
    </Pressable>
  )
}
