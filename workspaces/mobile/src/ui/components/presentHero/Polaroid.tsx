import { View, type ViewStyle } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated'

import {
  Backdrop,
  DottedBoard,
  Pic,
  SHADOW,
  type ThemeProps,
  scaleOf,
  useMount,
} from './shared'

// An instant photo taped to a dotted board; it drops in at a tilt.
export function Polaroid(p: ThemeProps) {
  const k = scaleOf(p)
  const pad = Math.round(p.tile * 0.05)
  const drop = useMount(v =>
    v.set(
      withTiming(1, { duration: 320, easing: Easing.out(Easing.back(1.6)) }),
    ),
  )
  const dropStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, drop.get() * 2),
    transform: [
      { scale: 1.25 - 0.25 * drop.get() },
      { rotate: `${-14 + 11 * drop.get()}deg` },
    ],
  }))
  return (
    <Backdrop {...p}>
      <DottedBoard p={p} />
      <Animated.View style={p.tileStyle}>
        <Animated.View
          style={[
            SHADOW,
            dropStyle,
            {
              backgroundColor: '#fff',
              padding: pad,
              paddingBottom: Math.round(p.tile * 0.14),
              borderRadius: 3 * k,
            },
          ]}
        >
          <Pic p={p} size={Math.round(p.tile * 0.8)} radius={2 * k} />
          <Tape
            k={k}
            style={{
              left: -18 * k,
              top: 6 * k,
              transform: [{ rotate: '-38deg' }],
            }}
          />
          <Tape
            k={k}
            style={{
              right: -18 * k,
              top: 6 * k,
              transform: [{ rotate: '38deg' }],
            }}
          />
        </Animated.View>
      </Animated.View>
    </Backdrop>
  )
}

function Tape({ k, style }: { k: number; style: ViewStyle }) {
  return (
    <View
      style={[
        {
          position: 'absolute',
          width: 74 * k,
          height: 24 * k,
          backgroundColor: 'rgba(245,226,180,0.82)',
          borderLeftWidth: 2 * k,
          borderRightWidth: 2 * k,
          borderStyle: 'dashed',
          borderColor: 'rgba(255,250,242,0.6)',
        },
        style,
      ]}
    />
  )
}
