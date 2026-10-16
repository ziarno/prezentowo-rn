import {
  type ReactNode,
  createContext,
  useContext,
  useEffect,
  useRef,
} from 'react'
import { View, type ViewStyle } from 'react-native'
import Animated, {
  type SharedValue,
  useReducedMotion,
  useSharedValue,
} from 'react-native-reanimated'
import Svg, { Defs, Pattern, Rect } from 'react-native-svg'

import type { DraftImage } from '@/api/draftImage'
import { garland } from '@/constants/colors'
import { PresentTile } from '@/ui/components/PresentTile'

type AnimatedStyle = React.ComponentProps<typeof Animated.View>['style']

export type ThemeProps = {
  gift: { _id: string; image?: DraftImage }
  // The backdrop's colour: the gift tag tone.
  tone: string
  // The picture's side; every theme is drawn for 300 and scaled to it.
  tile: number
  // How far down the picture starts.
  tileTop: number
  width: number
  // The backdrop's resting height, for what's drawn across all of it.
  height: number
  // A present still waiting in the offline queue.
  pending: boolean
  // The screen's scroll-driven backdrop height and picture shrink.
  heroStyle?: AnimatedStyle
  tileStyle?: AnimatedStyle
}

// How much smaller than the full-size picture a theme is drawn.
export const scaleOf = (p: ThemeProps) => p.tile / 300

// Patterns stay readable in the picker's thumbnails.
export const patternScaleOf = (p: ThemeProps) => Math.max(scaleOf(p), 0.5)

// A thumbnail in the picker: every animation rests on its last frame.
export const StillContext = createContext(false)

/**
 * A value the theme animates once it mounts (`animate` runs once). Still —
 * in a thumbnail, or with Reduce Motion on — it sits at `rest` instead.
 */
export function useMount(
  animate: (v: SharedValue<number>) => void,
  from = 0,
  rest = 1,
) {
  const reducedMotion = useReducedMotion()
  const still = useContext(StillContext) || reducedMotion
  const v = useSharedValue(still ? rest : from)
  const start = useRef(animate)
  useEffect(() => {
    if (!still) start.current(v)
  }, [v, still])
  return v
}

// A stable 0–1 pseudo-random number per index, so a scatter never jumps.
export const rand = (i: number, k = 1) => {
  const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453
  return x - Math.floor(x)
}

// The tone's partner: green on berry, berry on green.
export const otherTone = (tone: string) =>
  tone === garland.green ? garland.berry : garland.green

export const SHADOW: ViewStyle = {
  shadowColor: '#000',
  shadowOpacity: 0.25,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 10 },
}

// The tone's colour edge to edge, the picture `tileTop` down its middle.
export function Backdrop({
  tone,
  tileTop,
  heroStyle,
  children,
}: Pick<ThemeProps, 'tone' | 'tileTop' | 'heroStyle'> & {
  children: ReactNode
}) {
  return (
    <Animated.View
      pointerEvents="none"
      className="absolute inset-x-0 top-0 items-center overflow-hidden"
      style={[{ backgroundColor: tone, paddingTop: tileTop }, heroStyle]}
    >
      {children}
    </Animated.View>
  )
}

// A grid of faint paper dots over the backdrop, like a pinboard.
export function DottedBoard({ p }: { p: ThemeProps }) {
  const s = patternScaleOf(p)
  const step = 18 * s
  const dot = 2 * s
  return (
    <Svg style={{ position: 'absolute', inset: 0 }}>
      <Defs>
        <Pattern
          id="dots"
          width={step}
          height={step}
          patternUnits="userSpaceOnUse"
        >
          <Rect
            x={step / 2 - dot / 2}
            y={step / 2 - dot / 2}
            width={dot}
            height={dot}
            rx={dot / 2}
            fill="#fff"
          />
        </Pattern>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#dots)" opacity={0.18} />
    </Svg>
  )
}

// The present's picture; faded while it waits in the queue.
export function Pic({
  p,
  size,
  radius = 28 * scaleOf(p),
}: {
  p: ThemeProps
  size: number
  radius?: number
}) {
  return (
    <View style={p.pending ? { opacity: 0.55 } : undefined}>
      <PresentTile
        gift={p.gift}
        size={size}
        imageSize={Math.round(size * 0.84)}
        radius={radius}
        derivative={1000}
        pending={p.pending}
      />
    </View>
  )
}
