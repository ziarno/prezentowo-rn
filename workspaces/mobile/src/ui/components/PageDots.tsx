import Animated, {
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated'
import { View } from 'react-native'

import { garland } from '@/constants/colors'

const DOT_SIZE = 6
const ACTIVE_WIDTH = 24
const DURATION = 250

type DotProps = {
  index: number
  activeIndex: number
}

function Dot({ index, activeIndex }: DotProps) {
  const animatedStyle = useAnimatedStyle(() => {
    const active = index === activeIndex
    return {
      width: withTiming(active ? ACTIVE_WIDTH : DOT_SIZE, {
        duration: DURATION,
      }),
      backgroundColor: withTiming(active ? garland.green : garland.ink15, {
        duration: DURATION,
      }),
    }
  })

  return (
    <Animated.View
      style={[{ height: DOT_SIZE, borderRadius: DOT_SIZE / 2 }, animatedStyle]}
    />
  )
}

type Props = {
  count: number
  activeIndex: number
}

export function PageDots({ count, activeIndex }: Props) {
  return (
    <View className="flex-row gap-1.5">
      {Array.from({ length: count }, (_, n) => (
        <Dot key={n} index={n} activeIndex={activeIndex} />
      ))}
    </View>
  )
}
