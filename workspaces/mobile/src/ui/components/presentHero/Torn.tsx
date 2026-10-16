import { View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  withDelay,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Circle, Defs, Path, Pattern, Rect } from 'react-native-svg'

import { garland } from '@/constants/colors'

import {
  Backdrop,
  Pic,
  type ThemeProps,
  patternScaleOf,
  rand,
  scaleOf,
  useMount,
} from './shared'

// Polka-dot wrapping paper, ripped open around the picture.
export function Torn(p: ThemeProps) {
  const k = scaleOf(p)
  const s = patternScaleOf(p)
  // Big enough to still cover the backdrop while it grows from 30 %, and
  // while the picture shrinks or grows with the scroll.
  const SW = p.width * 5
  const SH = p.height * 7
  const cx = SW / 2
  const cy = SH / 2
  const jagged = (half: number, jitter: number, seed: number) => {
    const n = Math.ceil((2 * half) / Math.max(13 * k, 4))
    const step = (2 * half) / n
    const out = (j: number) => (rand(seed * 1000 + j, seed) - 0.3) * jitter
    const points: string[] = []
    let j = 0
    for (let i = 0; i < n; i++, j++)
      points.push(`${cx - half + i * step},${cy - half - out(j)}`)
    for (let i = 0; i < n; i++, j++)
      points.push(`${cx + half + out(j)},${cy - half + i * step}`)
    for (let i = 0; i < n; i++, j++)
      points.push(`${cx + half - i * step},${cy + half + out(j)}`)
    for (let i = 0; i < n; i++, j++)
      points.push(`${cx - half - out(j)},${cy + half - i * step}`)
    return `M${points.join(' L')} Z`
  }
  const sheet = `M0 0 H${SW} V${SH} H0 Z`
  const rip = useMount(v =>
    v.set(
      withDelay(
        200,
        withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) }),
      ),
    ),
  )
  const ripStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 0.3 + 0.7 * rip.get() }],
  }))
  return (
    <Backdrop {...p}>
      <Animated.View style={p.tileStyle}>
        {/* The box's inside, around the picture. */}
        <View
          style={{
            position: 'absolute',
            inset: -40 * k,
            backgroundColor: garland.paper2,
          }}
        />
        <Pic p={p} size={p.tile} />
        <Animated.View
          style={[
            {
              position: 'absolute',
              width: SW,
              height: SH,
              left: p.tile / 2 - cx,
              top: p.tile / 2 - cy,
            },
            ripStyle,
          ]}
        >
          <Svg width={SW} height={SH}>
            <Defs>
              <Pattern
                id="wrap"
                width={26 * s}
                height={26 * s}
                patternUnits="userSpaceOnUse"
              >
                <Rect width={26 * s} height={26 * s} fill={p.tone} />
                <Circle
                  cx={6 * s}
                  cy={6 * s}
                  r={3 * s}
                  fill="#fff"
                  opacity={0.25}
                />
                <Circle
                  cx={19 * s}
                  cy={19 * s}
                  r={3 * s}
                  fill={garland.amber}
                  opacity={0.6}
                />
              </Pattern>
            </Defs>
            {/* The paper's white underside, along the tear. */}
            <Path
              d={`${sheet} ${jagged(p.tile / 2 + 6 * k, 9 * k, 2)}`}
              fillRule="evenodd"
              fill="#fffdf8"
            />
            <Path
              d={`${sheet} ${jagged(p.tile / 2 + 16 * k, 10 * k, 1)}`}
              fillRule="evenodd"
              fill="url(#wrap)"
            />
          </Svg>
        </Animated.View>
      </Animated.View>
    </Backdrop>
  )
}
