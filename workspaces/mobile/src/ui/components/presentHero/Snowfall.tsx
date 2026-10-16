import { useContext } from 'react'
import { View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'

import {
  Backdrop,
  Pic,
  SHADOW,
  StillContext,
  type ThemeProps,
  patternScaleOf,
  rand,
  scaleOf,
  useMount,
} from './shared'

// Snow drifting down past the picture, a few flakes in front of it.
export function Snowfall(p: ThemeProps) {
  const still = useContext(StillContext)
  const s = patternScaleOf(p)
  const height = p.height + 60
  const flakes = (from: number, n: number) =>
    Array.from({ length: n }, (_, k) => (
      <Flake
        key={from + k}
        i={from + k}
        width={p.width}
        height={height}
        drift={14 * scaleOf(p)}
        scale={s}
      />
    ))
  return (
    <Backdrop {...p}>
      <View style={{ position: 'absolute', inset: 0 }}>
        {flakes(0, still ? 22 : 60)}
      </View>
      <Animated.View style={p.tileStyle}>
        <View style={SHADOW}>
          <Pic p={p} size={p.tile} />
        </View>
      </Animated.View>
      <View style={{ position: 'absolute', inset: 0 }}>
        {flakes(100, still ? 5 : 16)}
      </View>
    </Backdrop>
  )
}

function Flake({
  i,
  width,
  height,
  drift,
  scale,
}: {
  i: number
  width: number
  height: number
  drift: number
  scale: number
}) {
  const phase = rand(i, 1)
  const duration = 5000 + rand(i, 2) * 6000
  const size = (3 + rand(i, 3) * 6) * scale
  const x0 = rand(i, 4) * width
  // Starts part-way down its fall, so the screen opens already snowing.
  const t = useMount(
    v =>
      v.set(
        withSequence(
          withTiming(1, {
            duration: duration * (1 - phase),
            easing: Easing.linear,
          }),
          withRepeat(
            withSequence(
              withTiming(0, { duration: 0 }),
              withTiming(1, { duration, easing: Easing.linear }),
            ),
            -1,
          ),
        ),
      ),
    phase,
    phase,
  )
  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: x0 + Math.sin(t.get() * Math.PI * 4 + phase * 6) * drift },
      { translateY: -10 + t.get() * (height + 20) },
    ],
  }))
  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: '#fff',
          opacity: 0.35 + rand(i, 5) * 0.5,
        },
        style,
      ]}
    />
  )
}
