import { useTranslation } from 'react-i18next'
import { Pressable, View } from 'react-native'

import type { ResolvedParticipant } from '@/api/participants'
import {
  type GiftWrite,
  type ShownGift,
  viewerClaimOf,
} from '@/api/pendingWrites'
import { Text } from '@/components/ui/text'
import { garland } from '@/constants/colors'
import { usePersonName } from '@/hooks/usePersonName'
import { FAILED_KEY } from '@/ui/components/GiftRow'
import { PersonAvatar } from '@/ui/components/PersonAvatar'
import { PresentTile } from '@/ui/components/PresentTile'

// Whose idea a present is: the recipient's own wish, or someone else's
// suggestion.
export type GiftTone = 'own' | 'suggested'

export const TONE_COLOR: Record<GiftTone, string> = {
  own: garland.green,
  suggested: garland.berry,
}

type GiftTagProps = {
  gift: ShownGift
  tone: GiftTone
  onPress?: () => void
  // The people buying it, or undefined where the viewer may not see claim
  // state (`3e`).
  buyers?: (ResolvedParticipant | undefined)[]
  // A suggestion's author, shown as "by …" with their avatar.
  suggestedBy?: ResolvedParticipant
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

// A present on a person's list, drawn as a gift tag: a stub in the tone's
// colour holds the picture, a perforation, then the details.
export function GiftTag({
  gift,
  tone,
  onPress,
  buyers,
  suggestedBy,
  write,
  onDiscard,
}: GiftTagProps) {
  const { t } = useTranslation()
  const nameOf = usePersonName()
  const pendingAdd = write?.kind === 'add' && write.state === 'pending'
  const failed = write?.state === 'failed'
  const viewerClaim = viewerClaimOf(write)
  const buyerNames = (buyers ?? []).map(nameOf)

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className={`mx-4 mb-2.5 flex-row overflow-hidden rounded-xl border active:opacity-70 ${
        failed
          ? 'border-garland-berry bg-garland-berry/[0.06]'
          : 'border-garland-ink-08 bg-garland-paper'
      }`}
      style={pendingAdd ? { opacity: 0.55 } : undefined}
    >
      <View
        className="w-[88px] items-center justify-center py-3"
        style={{ backgroundColor: TONE_COLOR[tone] }}
      >
        <View className="absolute left-2 top-2 h-2 w-2 rounded-full bg-garland-paper" />
        <View className="rounded-xl bg-garland-paper">
          <PresentTile
            gift={gift}
            size={58}
            imageSize={52}
            pending={pendingAdd}
          />
        </View>
      </View>
      <View className="justify-around py-1">
        {Array.from({ length: 7 }, (_, i) => (
          <View
            key={i}
            className="-ml-[3px] h-1.5 w-1.5 rounded-full bg-garland-paper"
          />
        ))}
      </View>

      <View className="min-w-0 flex-1 justify-center py-3 pl-2 pr-3.5">
        <Text
          className="text-sm font-bold leading-[18px] text-garland-ink"
          numberOfLines={1}
        >
          {gift.title}
        </Text>
        {gift.description ? (
          <Text className="text-xs text-garland-ink-60" numberOfLines={1}>
            {gift.description}
          </Text>
        ) : null}
        {suggestedBy ? (
          <View className="mt-1 flex-row items-center gap-1.5">
            <PersonAvatar person={suggestedBy} size={16} />
            <Text
              className="flex-1 text-[11px] font-semibold text-garland-ink-60"
              numberOfLines={1}
            >
              {suggestedBy.isYou
                ? t('person.byYou')
                : t('person.byName', { name: nameOf(suggestedBy) })}
            </Text>
          </View>
        ) : null}
        {buyers && write?.kind !== 'add' ? (
          <Text
            className="mt-1 text-[11px] font-semibold text-garland-ink-60"
            numberOfLines={1}
          >
            {buyerNames.length > 0 ? `🛍 ${buyerNames.join(', ')}` : null}
            {viewerClaim ? (
              <Text
                className={
                  viewerClaim === 'failed'
                    ? 'text-garland-berry line-through'
                    : 'text-garland-green'
                }
              >
                {buyerNames.length > 0 ? ', ' : ''}
                {t(
                  viewerClaim === 'failed'
                    ? 'offline.you'
                    : 'offline.youWaiting',
                )}
              </Text>
            ) : null}
            {buyerNames.length === 0 && !viewerClaim
              ? t('person.nobodyBuying')
              : null}
          </Text>
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
