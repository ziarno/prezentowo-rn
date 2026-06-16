import { Image, View } from 'react-native'

import { present } from '@/constants/presents'

type PresentTileProps = {
  image: string | undefined
  // Outer rounded tile size.
  size?: number
  // Inner present image size. Defaults to ~88% of the tile.
  imageSize?: number
  radius?: number
}

export function PresentTile({
  image,
  size = 56,
  imageSize,
  radius = 12,
}: PresentTileProps) {
  const inner = imageSize ?? Math.round(size * 0.88)
  return (
    <View
      className="items-center justify-center bg-garland-paper2"
      style={{ width: size, height: size, borderRadius: radius }}
    >
      <Image
        source={present(image)}
        style={{ width: inner, height: inner }}
        resizeMode="contain"
      />
    </View>
  )
}
