import { View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Path } from 'react-native-svg'

import { garland } from '@/constants/colors'

import {
  Backdrop,
  Pic,
  SHADOW,
  type ThemeProps,
  scaleOf,
  useMount,
} from './shared'

const RAYS = 16

// [x, y] as a fraction of the picture, size at full scale, delay.
const SPARKLES: [number, number, number, number][] = [
  [-0.1, 0.1, 34, 0],
  [1.06, -0.04, 24, 500],
  [1.1, 0.6, 38, 1100],
  [-0.12, 0.76, 22, 1600],
  [0.66, -0.12, 20, 800],
  [0.3, 1.08, 26, 1900],
  [1.02, 1.0, 18, 300],
]

// Slowly turning rays behind the picture, sparkles twinkling around it.
export function Rays(p: ThemeProps) {
  const k = scaleOf(p)
  const D = p.width * 2.4
  const r = D / 2
  const spin = useMount(
    v =>
      v.set(
        withRepeat(
          withTiming(360, { duration: 60000, easing: Easing.linear }),
          -1,
        ),
      ),
    0,
    0,
  )
  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.get()}deg` }],
  }))
  const wedges = Array.from({ length: RAYS }, (_, i) => {
    const a = (i * 2 * Math.PI) / RAYS
    const b = a + Math.PI / RAYS
    return `M${r},${r} L${r + r * Math.cos(a)},${r + r * Math.sin(a)} L${r + r * Math.cos(b)},${r + r * Math.sin(b)} Z`
  }).join(' ')
  return (
    <Backdrop {...p}>
      <Animated.View
        style={[
          {
            position: 'absolute',
            width: D,
            height: D,
            left: p.width / 2 - r,
            top: p.tileTop + p.tile / 2 - r,
          },
          spinStyle,
        ]}
      >
        <Svg width={D} height={D}>
          <Path d={wedges} fill="#fff" opacity={0.12} />
        </Svg>
      </Animated.View>
      <Animated.View style={p.tileStyle}>
        <View style={SHADOW}>
          <Pic p={p} size={p.tile} />
        </View>
        {SPARKLES.map(([x, y, size, delay], i) => (
          <Sparkle
            key={i}
            left={x * p.tile}
            top={y * p.tile}
            size={size * k}
            delay={delay}
          />
        ))}
      </Animated.View>
    </Backdrop>
  )
}

function Sparkle({
  left,
  top,
  size,
  delay,
}: {
  left: number
  top: number
  size: number
  delay: number
}) {
  const s = useMount(v =>
    v.set(
      withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(1, {
              duration: 500,
              easing: Easing.out(Easing.back(3)),
            }),
            withTiming(0, { duration: 700 }),
            withTiming(0, { duration: 900 }),
          ),
          -1,
        ),
      ),
    ),
  )
  const style = useAnimatedStyle(() => ({
    opacity: s.get(),
    transform: [{ scale: s.get() }, { rotate: `${s.get() * 45}deg` }],
  }))
  const h = size / 2
  return (
    <Animated.View
      style={[{ position: 'absolute', left: left - h, top: top - h }, style]}
    >
      <Svg width={size} height={size}>
        <Path
          d={`M${h},0 Q${h},${h} ${size},${h} Q${h},${h} ${h},${size} Q${h},${h} 0,${h} Q${h},${h} ${h},0 Z`}
          fill={garland.paper}
        />
      </Svg>
    </Animated.View>
  )
}
