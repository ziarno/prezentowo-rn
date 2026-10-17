import { useState } from 'react'
import { type LayoutChangeEvent, Pressable, View } from 'react-native'
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated'

import { Text } from '@/components/ui/text'
import { garland } from '@/constants/colors'

const PADDING = 4
const DURATION = 220

export type SelectHorizontalOption<T extends string> = {
  value: T
  label: string
}

type Props<T extends string> = {
  options: readonly SelectHorizontalOption<T>[]
  value: T
  onChange: (value: T) => void
}

export function SelectHorizontal<T extends string>({
  options,
  value,
  onChange,
}: Props<T>) {
  const [width, setWidth] = useState(0)
  const segmentWidth = width > 0 ? (width - PADDING * 2) / options.length : 0
  const activeIndex = Math.max(
    options.findIndex(o => o.value === value),
    0,
  )

  const indicatorStyle = useAnimatedStyle(() => ({
    width: segmentWidth,
    transform: [
      {
        translateX: withTiming(activeIndex * segmentWidth, {
          duration: DURATION,
        }),
      },
    ],
  }))

  const onLayout = (e: LayoutChangeEvent) =>
    setWidth(e.nativeEvent.layout.width)

  return (
    <View
      onLayout={onLayout}
      className="flex-row rounded-full bg-garland-ink-08 p-1"
    >
      {segmentWidth > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              top: PADDING,
              bottom: PADDING,
              left: PADDING,
              borderRadius: 9999,
              backgroundColor: garland.paper,
              // Inline shadow rather than a `shadow-*` class — that NativeWind
              // class triggers a CSS-interop pass that races React Navigation
              // and crashes the bottom-sheet portal.
              shadowColor: garland.ink,
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.08,
              shadowRadius: 2,
              elevation: 1,
            },
            indicatorStyle,
          ]}
        />
      )}
      {options.map(option => {
        const active = option.value === value
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            className="flex-1 items-center rounded-full py-2"
          >
            <Text
              className={`text-[13px] font-semibold ${
                active ? 'text-garland-ink' : 'text-garland-ink-40'
              }`}
            >
              {option.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}
