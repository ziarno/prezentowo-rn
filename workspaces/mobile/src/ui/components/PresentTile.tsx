import type { ImageRef, ImageSize } from '@prezentowo/types'
import { Image } from 'expo-image'
import { View } from 'react-native'

import { uploadImageUrl } from '@/api/images'
import { present } from '@/constants/presents'

type PresentTileProps = {
  image: ImageRef | undefined
  // Outer rounded tile size.
  size?: number
  // Inner illustration size. Defaults to ~88% of the tile. A photo always
  // fills the tile.
  imageSize?: number
  radius?: number
  // Which derivative of an upload to load: the 400 px tile by default.
  derivative?: ImageSize
}

// A present's image: an upload's WebP derivative, or its bundled illustration.
// An empty or unknown illustration falls back to stock art.
export function PresentTile({
  image,
  size = 56,
  imageSize,
  radius = 12,
  derivative = 400,
}: PresentTileProps) {
  const inner = imageSize ?? Math.round(size * 0.88)
  return (
    <View
      className="items-center justify-center overflow-hidden bg-garland-paper2"
      style={{ width: size, height: size, borderRadius: radius }}
    >
      {image?.kind === 'upload' ? (
        <Image
          source={{ uri: uploadImageUrl(image.id, derivative) }}
          style={{ width: size, height: size }}
          contentFit="cover"
          transition={150}
        />
      ) : (
        <Image
          source={present(image?.id)}
          style={{ width: inner, height: inner }}
          contentFit="contain"
        />
      )}
    </View>
  )
}
