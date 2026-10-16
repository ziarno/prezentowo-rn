import { View } from 'react-native'
import Animated, {
  Easing,
  type SharedValue,
  useAnimatedStyle,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'

import { garland } from '@/constants/colors'

import {
  Backdrop,
  DottedBoard,
  Pic,
  SHADOW,
  type ThemeProps,
  otherTone,
  rand,
  scaleOf,
  useMount,
} from './shared'

// Seconds a burst lasts.
const BURST = 1.6

// Confetti bursts out of the top of the picture, every few seconds.
export function Confetti(p: ThemeProps) {
  const k = scaleOf(p)
  const t = useMount(
    v =>
      v.set(
        withRepeat(
          withSequence(
            withTiming(0, { duration: 0 }),
            withDelay(
              200,
              withTiming(BURST, {
                duration: BURST * 1000,
                easing: Easing.linear,
              }),
            ),
            withDelay(2800, withTiming(BURST, { duration: 0 })),
          ),
          -1,
        ),
      ),
    0,
    // Mid-burst, for a thumbnail.
    0.45,
  )
  const colors = [garland.amber, garland.paper, otherTone(p.tone), '#f6d77a']
  return (
    <Backdrop {...p}>
      <DottedBoard p={p} />
      <Animated.View style={p.tileStyle}>
        <View style={SHADOW}>
          <Pic p={p} size={p.tile} />
        </View>
        {Array.from({ length: 64 }, (_, i) => (
          <Piece
            key={i}
            i={i}
            t={t}
            k={k}
            x0={p.tile * (0.15 + 0.7 * rand(i, 9))}
            color={colors[i % colors.length]}
          />
        ))}
      </Animated.View>
    </Backdrop>
  )
}

function Piece({
  i,
  t,
  k,
  x0,
  color,
}: {
  i: number
  t: SharedValue<number>
  k: number
  x0: number
  color: string
}) {
  const angle = -Math.PI / 2 + (rand(i) - 0.5) * Math.PI * 1.3
  const speed = (180 + rand(i, 2) * 260) * k
  const vx = Math.cos(angle) * speed
  const vy = Math.sin(angle) * speed
  const gravity = 360 * k
  const spin = (rand(i, 3) - 0.5) * 1440
  const w = Math.max((9 + rand(i, 4) * 8) * k, 2)
  const h = rand(i, 5) > 0.5 ? w : w * 0.45
  const style = useAnimatedStyle(() => {
    const s = t.get()
    return {
      opacity:
        s === 0 || s >= BURST ? 0 : s > BURST - 0.4 ? (BURST - s) / 0.4 : 1,
      transform: [
        { translateX: vx * s },
        { translateY: vy * s + gravity * s * s },
        { rotate: `${spin * s}deg` },
        { scaleX: Math.cos(s * (6 + i)) },
      ],
    }
  })
  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: x0,
          top: 0,
          width: w,
          height: h,
          borderRadius: h === w ? w / 2 : 1,
          backgroundColor: color,
        },
        style,
      ]}
    />
  )
}
