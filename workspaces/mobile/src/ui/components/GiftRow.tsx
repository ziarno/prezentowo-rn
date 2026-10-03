import { useTranslation } from 'react-i18next'
import { Pressable, View } from 'react-native'

import {
  type GiftWrite,
  type ShownGift,
  viewerClaimOf,
} from '@/api/pendingWrites'
import { Text } from '@/components/ui/text'
import { BuyerChips } from '@/ui/components/BuyerChips'
import { GiftFlag } from '@/ui/components/GiftFlag'
import { PresentTile } from '@/ui/components/PresentTile'

type GiftRowProps = {
  gift: ShownGift
  onPress?: () => void
  // Shown as a small "For …" eyebrow above the title (event-wide list).
  forName?: string
  // Shown under the title instead of the eyebrow (single-person list).
  showDescription?: boolean
  // The names of the people buying it, as `🛍` chips (or "Open" when
  // empty). Omitted where the viewer may not see claim state (`3e`).
  buyers?: string[]
  topBorder?: boolean
  // The viewer's write on it still in the offline queue (docs/spec.md §6.4).
  write?: GiftWrite
  // Drops a failed `write`.
  onDiscard?: () => void
}

const WAITING_KEY = {
  add: 'offline.willAdd',
  claim: 'offline.claimWaiting',
  unclaim: 'offline.unclaimWaiting',
} as const

export const FAILED_KEY = {
  add: 'offline.addFailed',
  claim: 'offline.claimFailed',
  unclaim: 'offline.unclaimFailed',
} as const

export function GiftRow({
  gift,
  onPress,
  forName,
  showDescription = false,
  buyers,
  topBorder = false,
  write,
  onDiscard,
}: GiftRowProps) {
  const { t } = useTranslation()
  const pendingAdd = write?.kind === 'add' && write.state === 'pending'
  const failed = write?.state === 'failed'
  const viewerClaim = viewerClaimOf(write)

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className={`flex-row items-center gap-3.5 px-[22px] py-3.5 active:opacity-70 ${
        topBorder
          ? 'border-t border-garland-ink-08'
          : 'border-b border-garland-ink-08'
      } ${failed ? 'bg-garland-berry/[0.06]' : ''}`}
      style={pendingAdd ? { opacity: 0.55 } : undefined}
    >
      {failed ? (
        <View className="absolute bottom-0 left-0 top-0 w-[3px] bg-garland-berry" />
      ) : null}

      <PresentTile gift={gift} size={56} imageSize={50} pending={pendingAdd} />

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
        {buyers && write?.kind !== 'add' ? (
          <View className="mt-1.5">
            {buyers.length > 0 || viewerClaim ? (
              <BuyerChips names={buyers} viewerClaim={viewerClaim} />
            ) : (
              <GiftFlag claimed={false} />
            )}
          </View>
        ) : null}
        {write ? (
          <View className="mt-1 flex-row flex-wrap items-center gap-x-2">
            <Text
              className={`text-[11px] font-semibold ${
                failed ? 'text-garland-berry' : 'text-garland-amber'
              }`}
            >
              {failed ? t(FAILED_KEY[write.kind]) : t(WAITING_KEY[write.kind])}
            </Text>
            {failed && onDiscard ? (
              <Pressable
                onPress={onDiscard}
                hitSlop={10}
                accessibilityRole="button"
              >
                <Text className="text-[11px] font-bold text-garland-berry underline">
                  {t('offline.discard')}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>
    </Pressable>
  )
}
