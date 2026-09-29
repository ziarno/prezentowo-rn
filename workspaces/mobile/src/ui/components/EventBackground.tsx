import type { ImageSize } from '@prezentowo/types'
import { Image } from 'expo-image'
import { type DimensionValue, View } from 'react-native'

import { type DraftImage, isPhoto } from '@/api/draftImage'
import { photoUri } from '@/api/images'
import { backgroundArt } from '@/api/stockArt'
import { garland } from '@/constants/colors'
import { StockBackground } from '@/ui/components/StockBackground'

type EventBackgroundProps = {
  // A wizard's photo not yet uploaded shows from the device.
  event: { _id: string; background?: DraftImage }
  height: DimensionValue
  // Which derivative of an upload to load.
  derivative?: ImageSize
}

// An event's background: its uploaded photo, its stock background, or the
// §1.1 fallback picked from the event `_id`.
export function EventBackground({
  event,
  height,
  derivative = 1000,
}: EventBackgroundProps) {
  const { background } = event
  if (isPhoto(background)) {
    return (
      <Image
        source={{ uri: photoUri(background, derivative) }}
        style={{ width: '100%', height, backgroundColor: garland.paper2 }}
        contentFit="cover"
        transition={150}
      />
    )
  }
  return (
    <View style={{ width: '100%', height }}>
      <StockBackground id={backgroundArt(background, event._id)} />
    </View>
  )
}
