import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { View } from 'react-native'

import type { ViewerClaim } from '@/api/pendingWrites'
import { Text } from '@/components/ui/text'

// One `🛍` chip per person buying a present — buying isn't exclusive, so
// there can be several. Never rendered for the present's recipient. The
// viewer's own queued claim is dashed while it waits to send, and struck
// through in berry once its replay failed. With `avatars` (one per name, and
// `viewerAvatar` for the viewer's queued claim) each chip leads with the
// person's avatar instead of the `🛍`.
export function BuyerChips({
  names,
  viewerClaim,
  avatars,
  viewerAvatar,
}: {
  names: string[]
  viewerClaim?: ViewerClaim
  avatars?: ReactNode[]
  viewerAvatar?: ReactNode
}) {
  const { t } = useTranslation()
  return (
    <View className="flex-row flex-wrap gap-1.5">
      {names.map((name, i) => (
        <View
          key={`${i}-${name}`}
          className={`flex-row items-center gap-1.5 rounded-full bg-garland-paper2 py-1 pr-2.5 ${avatars ? 'pl-1' : 'pl-2.5'}`}
        >
          {avatars?.[i]}
          <Text className="text-[11px] font-bold text-garland-ink">
            {avatars ? name : `🛍 ${name}`}
          </Text>
        </View>
      ))}
      {viewerClaim === 'waiting' ? (
        <View
          className={`flex-row items-center gap-1.5 rounded-full border border-dashed border-garland-green py-1 pr-2.5 ${viewerAvatar ? 'pl-1' : 'pl-2.5'}`}
        >
          {viewerAvatar}
          <Text className="text-[11px] font-bold text-garland-green">
            {t('offline.youWaiting')}
          </Text>
        </View>
      ) : viewerClaim === 'failed' ? (
        <View
          className={`flex-row items-center gap-1.5 rounded-full border border-garland-berry py-1 pr-2.5 ${viewerAvatar ? 'pl-1' : 'pl-2.5'}`}
        >
          {viewerAvatar}
          <Text className="text-[11px] font-bold text-garland-berry line-through">
            {t('offline.you')}
          </Text>
        </View>
      ) : null}
    </View>
  )
}
