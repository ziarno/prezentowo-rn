import { useTranslation } from 'react-i18next'
import { View } from 'react-native'
import Svg, { Path } from 'react-native-svg'

import { Text } from '@/components/ui/text'
import { garland } from '@/constants/colors'

type GiftFlagProps = {
  claimed: boolean
  // Number of people who have claimed it (shown as "Claimed · N" when > 1).
  claimers?: number
}

// The small flag + status label used on gift rows. Green "Open" when nobody has
// claimed, berry "Claimed" once someone has.
export function GiftFlag({ claimed, claimers = 0 }: GiftFlagProps) {
  const { t } = useTranslation()
  const color = claimed ? garland.berry : garland.green
  const label = claimed
    ? claimers > 1
      ? t('giftDetail.claimedCount', { count: claimers })
      : t('giftDetail.claimed')
    : t('giftDetail.open')

  return (
    <View className="flex-row items-center gap-1.5">
      <Svg width={10} height={12} viewBox="0 0 10 12" fill={color}>
        <Path d="M0,0 L10,0 L7,5 L10,12 L0,12 Z" />
      </Svg>
      <Text
        className="text-[11px] font-bold uppercase"
        style={{ color, letterSpacing: 0.88 }}
      >
        {label}
      </Text>
    </View>
  )
}
