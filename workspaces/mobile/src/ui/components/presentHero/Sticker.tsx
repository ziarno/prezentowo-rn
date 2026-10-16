import type { ReactNode } from 'react'
import type { ViewStyle } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import Svg, {
  Defs,
  LinearGradient,
  Path,
  Polygon,
  Stop,
} from 'react-native-svg'

import { garland } from '@/constants/colors'

import {
  Backdrop,
  DottedBoard,
  Pic,
  type ThemeProps,
  otherTone,
  scaleOf,
  useMount,
} from './shared'

// A die-cut sticker slapped on a dotted board, its corner peeling, with two
// small stickers beside it.
export function Sticker(p: ThemeProps) {
  const k = scaleOf(p)
  const S = Math.round(p.tile * 0.9)
  const border = 10 * k
  const peel = 70 * k
  const slap = useMount(v =>
    v.set(withTiming(1, { duration: 240, easing: Easing.out(Easing.cubic) })),
  )
  const slapStyle = useAnimatedStyle(() => ({
    opacity: slap.get(),
    transform: [
      { scale: 1.2 - 0.2 * slap.get() },
      { rotate: `${-6 + 9 * slap.get()}deg` },
    ],
  }))
  const flap = `M${peel} 0 Q${peel * 0.5} ${peel * 0.12} ${3 * k} ${3 * k} Q${peel * 0.12} ${peel * 0.5} 0 ${peel} Z`
  return (
    <Backdrop {...p}>
      <DottedBoard p={p} />
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
        <MiniSticker
          k={k}
          delay={350}
          deg={-14}
          style={{ left: -26 * k, top: p.tile * 0.62 }}
        >
          <Polygon
            points="30,3 37,21 57,22 41,34 47,54 30,42 13,54 19,34 3,22 23,21"
            fill={garland.amber}
            stroke="#fff"
            strokeWidth={5}
            strokeLinejoin="round"
          />
        </MiniSticker>
        <Animated.View
          style={[
            {
              width: S,
              height: S,
              padding: border,
              backgroundColor: '#fff',
              borderRadius: 34 * k,
              shadowColor: '#000',
              shadowOpacity: 0.2,
              shadowRadius: 8 * k,
              shadowOffset: { width: 0, height: 4 * k },
            },
            slapStyle,
          ]}
        >
          <Pic p={p} size={S - 2 * border} radius={24 * k} />
          <Svg
            width={peel}
            height={peel}
            style={{ position: 'absolute', right: 0, bottom: 0 }}
          >
            <Defs>
              <LinearGradient id="peel" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor="#ffffff" />
                <Stop offset="1" stopColor="#d6d0c6" />
              </LinearGradient>
            </Defs>
            {/* Where the corner came off, then the corner folded over. */}
            <Path
              d={`M${peel} 0 L${peel} ${peel} L0 ${peel} Z`}
              fill={p.tone}
            />
            <Path
              d={flap}
              fill="#000"
              opacity={0.18}
              transform={`translate(${3 * k} ${3 * k})`}
            />
            <Path d={flap} fill="url(#peel)" />
          </Svg>
        </Animated.View>
        <MiniSticker
          k={k}
          delay={500}
          deg={16}
          style={{ right: -26 * k, top: p.tile * 0.28 }}
        >
          <Path
            d="M30 52 C10 38 3 28 3 18 C3 9 10 3 18 3 C24 3 28 7 30 11 C32 7 36 3 42 3 C50 3 57 9 57 18 C57 28 50 38 30 52 Z"
            fill={otherTone(p.tone)}
            stroke="#fff"
            strokeWidth={5}
            strokeLinejoin="round"
          />
        </MiniSticker>
      </Animated.View>
    </Backdrop>
  )
}

function MiniSticker({
  k,
  delay,
  deg,
  style,
  children,
}: {
  k: number
  delay: number
  deg: number
  style: ViewStyle
  children: ReactNode
}) {
  const s = useMount(v =>
    v.set(withDelay(delay, withSpring(1, { damping: 8, stiffness: 260 }))),
  )
  const anim = useAnimatedStyle(() => ({
    opacity: Math.min(1, s.get() * 3),
    transform: [{ scale: s.get() }, { rotate: `${deg}deg` }],
  }))
  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          zIndex: 2,
          shadowColor: '#000',
          shadowOpacity: 0.2,
          shadowRadius: 3 * k,
          shadowOffset: { width: 0, height: 2 * k },
        },
        style,
        anim,
      ]}
    >
      <Svg width={60 * k} height={58 * k} viewBox="0 0 60 58">
        {children}
      </Svg>
    </Animated.View>
  )
}
