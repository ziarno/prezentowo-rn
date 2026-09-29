import type { ImageSize } from '@prezentowo/types'
import { Image } from 'expo-image'
import { type DimensionValue, View } from 'react-native'

import type { DraftImage } from '@/api/draftImage'
import { stablePick } from '@/api/eventList'
import { photoUri } from '@/api/images'
import { garland } from '@/constants/colors'

// Until the stock patterns land (#43), an empty or illustration background
// falls back to a tint picked from the event `_id`.
const FALLBACK_TINTS = [
  garland.green,
  garland.amber,
  garland.berry,
  garland.moss,
] as const

type EventBackgroundProps = {
  // A wizard's photo not yet uploaded shows from the device.
  event: { _id: string; background?: DraftImage }
  height: DimensionValue
  // Which derivative of an upload to load.
  derivative?: ImageSize
}

// An event's background: its uploaded photo, else the §1.1 fallback.
export function EventBackground({
  event,
  height,
  derivative = 1000,
}: EventBackgroundProps) {
  const { background } = event
  if (background?.kind === 'upload' || background?.kind === 'local') {
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
    <View
      style={{
        height,
        backgroundColor: stablePick(event._id, FALLBACK_TINTS),
      }}
    />
  )
}
