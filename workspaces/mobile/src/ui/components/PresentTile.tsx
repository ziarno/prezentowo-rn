import type { ImageSize } from '@prezentowo/types'
import { Image } from 'expo-image'
import { View } from 'react-native'

import { type DraftImage, isPhoto } from '@/api/draftImage'
import { photoUri } from '@/api/images'
import { presentArt } from '@/api/stockArt'
import { PRESENT_SOURCES } from '@/constants/presents'

type PresentTileProps = {
  // A wizard's photo not yet uploaded shows from the device.
  gift: { _id: string; image?: DraftImage }
  // Outer rounded tile size.
  size?: number
  // Inner illustration size. Defaults to ~88% of the tile. A photo always
  // fills the tile.
  imageSize?: number
  radius?: number
  // Which derivative of an upload to load: the 400 px tile by default.
  derivative?: ImageSize
  // A present still waiting in the offline queue: a dashed outline.
  pending?: boolean
}

// A present's image: an upload's WebP derivative (or a picked photo still on
// the device), its present illustration, or the §1.1 fallback picked from
// the gift `_id`.
export function PresentTile({
  gift,
  size = 56,
  imageSize,
  radius = 12,
  derivative = 400,
  pending = false,
}: PresentTileProps) {
  const inner = imageSize ?? Math.round(size * 0.88)
  const { image } = gift
  return (
    <View
      className="items-center justify-center overflow-hidden bg-garland-paper2"
      style={{ width: size, height: size, borderRadius: radius }}
    >
      {isPhoto(image) ? (
        <Image
          source={{ uri: photoUri(image, derivative) }}
          style={{ width: size, height: size }}
          contentFit="cover"
          transition={150}
        />
      ) : (
        <Image
          source={PRESENT_SOURCES[presentArt(image, gift._id)]}
          style={{ width: inner, height: inner }}
          contentFit="contain"
        />
      )}
      {pending ? (
        <View
          pointerEvents="none"
          className="absolute inset-0 border-[1.5px] border-dashed border-garland-ink-40"
          style={{ borderRadius: radius }}
        />
      ) : null}
    </View>
  )
}
