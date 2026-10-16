import { View } from 'react-native'
import Animated, {
  useAnimatedStyle,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Circle, G, Polygon } from 'react-native-svg'

import { garland } from '@/constants/colors'

import {
  Backdrop,
  Pic,
  type ThemeProps,
  patternScaleOf,
  scaleOf,
  useMount,
} from './shared'

// Comic-book halftone dots, an inked outline with a hard shadow, and a
// pulsing burst on the corner.
export function PopArt(p: ThemeProps) {
  const k = scaleOf(p)
  const s = patternScaleOf(p)
  const cx = p.width / 2
  const cy = p.tileTop + p.tile / 2
  const step = 15 * s
  const dots = []
  for (let row = 0, y = step / 2; y < p.height; row++, y += step)
    for (let x = row % 2 ? step / 2 : step; x < p.width; x += step) {
      // Clear behind the picture, growing towards the edges.
      const d = Math.hypot(x - cx, y - cy)
      const r =
        6 * s * Math.min(1, Math.max(0, (d - p.tile * 0.35) / (p.width * 0.55)))
      if (r > 0.6) dots.push(<Circle key={`${x},${y}`} cx={x} cy={y} r={r} />)
    }
  const pop = useMount(v =>
    v.set(
      withSequence(
        withDelay(300, withSpring(1, { damping: 7, stiffness: 260 })),
        withRepeat(
          withSequence(
            withTiming(1.08, { duration: 600 }),
            withTiming(1, { duration: 600 }),
          ),
          -1,
        ),
      ),
    ),
  )
  const popStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pop.get() }, { rotate: '-12deg' }],
  }))
  const B = 96 * k
  const burst = Array.from({ length: 28 }, (_, i) => {
    const a = (i * Math.PI) / 14
    const r = (i % 2 ? 30 : 46) * k
    return `${B / 2 + r * Math.cos(a)},${B / 2 + r * Math.sin(a)}`
  }).join(' ')
  const S = Math.round(p.tile * 0.92)
  const ink = Math.max(3 * k, 1.5)
  const radius = 20 * k
  return (
    <Backdrop {...p}>
      <Svg
        width={p.width}
        height={p.height}
        style={{ position: 'absolute', top: 0 }}
      >
        <G fill={garland.paper} opacity={0.22}>
          {dots}
        </G>
      </Svg>
      <Animated.View
        style={[
          {
            width: p.tile,
            height: p.tile,
            alignItems: 'center',
            justifyContent: 'center',
          },
          p.tileStyle,
        ]}
      >
        <View>
          <View
            style={{
              position: 'absolute',
              left: 10 * k,
              top: 10 * k,
              width: S,
              height: S,
              borderRadius: radius,
              backgroundColor: garland.ink,
            }}
          />
          <View
            style={{
              borderWidth: ink,
              borderColor: garland.ink,
              borderRadius: radius,
              overflow: 'hidden',
            }}
          >
            <Pic p={p} size={S - 2 * ink} radius={radius - ink} />
          </View>
          <Animated.View
            style={[
              { position: 'absolute', left: -36 * k, bottom: -36 * k },
              popStyle,
            ]}
          >
            <Svg width={B} height={B}>
              <Polygon
                points={burst}
                fill={garland.amber}
                stroke={garland.ink}
                strokeWidth={ink}
                strokeLinejoin="round"
              />
            </Svg>
          </Animated.View>
        </View>
      </Animated.View>
    </Backdrop>
  )
}
