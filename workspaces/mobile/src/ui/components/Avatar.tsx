import { Image, type ImageSourcePropType, View } from 'react-native'

type AvatarProps = {
  source: ImageSourcePropType
  size?: number
}

export function Avatar({ source, size = 32 }: AvatarProps) {
  return (
    <Image
      source={source}
      style={{ width: size, height: size, borderRadius: size / 2 }}
    />
  )
}

type AvatarStackProps = {
  sources: ImageSourcePropType[]
  size?: number
  ringColor?: string
}

export function AvatarStack({
  sources,
  size = 28,
  ringColor = '#fffaf2',
}: AvatarStackProps) {
  const overlap = Math.round(size * 0.35)
  return (
    <View className="flex-row">
      {sources.map((src, i) => (
        <View
          key={i}
          style={{
            marginLeft: i === 0 ? 0 : -overlap,
            padding: 2,
            backgroundColor: ringColor,
            borderRadius: (size + 4) / 2,
          }}
        >
          <Avatar source={src} size={size} />
        </View>
      ))}
    </View>
  )
}
