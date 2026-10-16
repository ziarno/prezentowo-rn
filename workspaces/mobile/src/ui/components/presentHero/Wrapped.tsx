import { View } from 'react-native'
import Animated from 'react-native-reanimated'
import Svg, { Defs, Pattern, Rect } from 'react-native-svg'

import { garland } from '@/constants/colors'

import {
  Backdrop,
  Pic,
  SHADOW,
  type ThemeProps,
  patternScaleOf,
  scaleOf,
} from './shared'

// Striped wrapping paper, with a ribbon crossing behind the picture.
export function Wrapped(p: ThemeProps) {
  const k = scaleOf(p)
  const s = patternScaleOf(p)
  const band = Math.max(22 * k, 4)
  const edge = Math.max(2 * k, 1)
  return (
    <Backdrop {...p}>
      <Svg style={{ position: 'absolute', inset: 0 }}>
        <Defs>
          <Pattern
            id="stripes"
            width={30 * s}
            height={30 * s}
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(35)"
          >
            <Rect width={9 * s} height={30 * s} fill="#fff" opacity={0.1} />
            <Rect
              x={17 * s}
              y={13 * s}
              width={4 * s}
              height={4 * s}
              rx={2 * s}
              fill="#fff"
              opacity={0.22}
            />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#stripes)" />
      </Svg>
      <View
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          width: band,
          left: p.width / 2 - band / 2,
          backgroundColor: garland.amber,
          borderLeftWidth: edge,
          borderRightWidth: edge,
          borderColor: garland.amberInk,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          height: band,
          top: p.tileTop + p.tile / 2 - band / 2,
          backgroundColor: garland.amber,
          borderTopWidth: edge,
          borderBottomWidth: edge,
          borderColor: garland.amberInk,
        }}
      />
      <Animated.View style={p.tileStyle}>
        <View style={SHADOW}>
          <Pic p={p} size={p.tile} />
        </View>
      </Animated.View>
    </Backdrop>
  )
}
