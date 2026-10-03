import { useTranslation } from 'react-i18next'
import { View } from 'react-native'

import type { ViewerClaim } from '@/api/pendingWrites'
import { Text } from '@/components/ui/text'

// One `🛍` chip per person buying a present — buying isn't exclusive, so
// there can be several. Never rendered for the present's recipient. The
// viewer's own queued claim is dashed while it waits to send, and struck
// through in berry once its replay failed.
export function BuyerChips({
  names,
  viewerClaim,
}: {
  names: string[]
  viewerClaim?: ViewerClaim
}) {
  const { t } = useTranslation()
  return (
    <View className="flex-row flex-wrap gap-1.5">
      {names.map((name, i) => (
        <View
          key={`${i}-${name}`}
          className="flex-row items-center rounded-full bg-garland-paper2 px-2.5 py-1"
        >
          <Text className="text-[11px] font-bold text-garland-ink">
            🛍 {name}
          </Text>
        </View>
      ))}
      {viewerClaim === 'waiting' ? (
        <View className="flex-row items-center rounded-full border border-dashed border-garland-green px-2.5 py-1">
          <Text className="text-[11px] font-bold text-garland-green">
            {t('offline.youWaiting')}
          </Text>
        </View>
      ) : viewerClaim === 'failed' ? (
        <View className="flex-row items-center rounded-full border border-garland-berry px-2.5 py-1">
          <Text className="text-[11px] font-bold text-garland-berry line-through">
            {t('offline.you')}
          </Text>
        </View>
      ) : null}
    </View>
  )
}
