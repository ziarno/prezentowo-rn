import { Image, type ImageSourcePropType, Pressable, View } from 'react-native'

import { CheckIcon } from '@/components/ui/icon'
import { garland } from '@/constants/colors'

type Props = {
  source: ImageSourcePropType
  selected: boolean
  onPress: () => void
}

export function AvatarTile({ source, selected, onPress }: Props) {
  return (
    <Pressable onPress={onPress} className="relative aspect-square">
      <View
        className={`size-full overflow-hidden rounded-full border-[2.5px] bg-[rgba(0,0,0,0.02)] ${
          selected ? 'border-garland-green p-0.5' : 'border-transparent'
        }`}
      >
        <Image
          source={source}
          className="size-full rounded-full"
          resizeMode="cover"
        />
      </View>
      {selected && (
        <View className="absolute -bottom-0.5 -right-0.5 h-[18px] w-[18px] items-center justify-center rounded-full border-2 border-garland-paper bg-garland-green">
          <CheckIcon width={10} height={10} color={garland.paper} />
        </View>
      )}
    </Pressable>
  )
}
