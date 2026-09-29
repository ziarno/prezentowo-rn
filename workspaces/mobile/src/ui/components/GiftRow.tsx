import type { GiftDoc } from '@prezentowo/types'
import { useTranslation } from 'react-i18next'
import { Pressable, View } from 'react-native'

import { Text } from '@/components/ui/text'
import { BuyerChips } from '@/ui/components/BuyerChips'
import { GiftFlag } from '@/ui/components/GiftFlag'
import { PresentTile } from '@/ui/components/PresentTile'

type GiftRowProps = {
  gift: GiftDoc
  onPress?: () => void
  // Shown as a small "For …" eyebrow above the title (event-wide list).
  forName?: string
  // Shown under the title instead of the eyebrow (single-person list).
  showDescription?: boolean
  // The names of the people buying it, as `🛍` chips (or "Open" when
  // empty). Omitted where the viewer may not see claim state (`3e`).
  buyers?: string[]
  topBorder?: boolean
}

export function GiftRow({
  gift,
  onPress,
  forName,
  showDescription = false,
  buyers,
  topBorder = false,
}: GiftRowProps) {
  const { t } = useTranslation()

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className={`flex-row items-center gap-3.5 px-[22px] py-3.5 active:opacity-70 ${
        topBorder
          ? 'border-t border-garland-ink-08'
          : 'border-b border-garland-ink-08'
      }`}
    >
      <PresentTile gift={gift} size={56} imageSize={50} />

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
        {buyers ? (
          <View className="mt-1.5">
            {buyers.length > 0 ? (
              <BuyerChips names={buyers} />
            ) : (
              <GiftFlag claimed={false} />
            )}
          </View>
        ) : null}
      </View>
    </Pressable>
  )
}
