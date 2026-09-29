import type { EventDoc, ImageSize } from '@prezentowo/types'
import { Image } from 'expo-image'
import { View } from 'react-native'

import { stablePick } from '@/api/eventList'
import { uploadImageUrl } from '@/api/images'
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
  event: Pick<EventDoc, '_id' | 'background'>
  height: number
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
  if (background?.kind === 'upload') {
    return (
      <Image
        source={{ uri: uploadImageUrl(background.id, derivative) }}
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
