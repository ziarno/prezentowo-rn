import { View } from 'react-native'
import Animated from 'react-native-reanimated'
import Svg, { Circle, G } from 'react-native-svg'

import { garland } from '@/constants/colors'

import {
  Backdrop,
  Pic,
  type ThemeProps,
  patternScaleOf,
  scaleOf,
} from './shared'

// Comic-book halftone dots, and an inked outline with a hard shadow.
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
        </View>
      </Animated.View>
    </Backdrop>
  )
}
