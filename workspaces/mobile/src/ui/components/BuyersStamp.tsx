import { type ReactNode, useEffect } from 'react'
import { View } from 'react-native'
import Animated, {
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated'

import { Text } from '@/components/ui/text'
import { garland } from '@/constants/colors'
import { BuyerSeal } from '@/ui/components/BuyerSeal'

const SEAL = 34
const TILT = -3

type StampProps = { label: string; lines: ReactNode[]; play: boolean }

// The ways the stamp can arrive. The present screen picks one each time it
// opens, so it doesn't get stale.
const ENTRANCES = [SlamStamp, RollStamp, InkPulseStamp, SwingStamp]

export type StampEntrance = number

export const randomStampEntrance = (): StampEntrance =>
  Math.floor(Math.random() * ENTRANCES.length)

// Who is buying it, as a rubber stamp: the seal, the label, a name a line.
// Hidden until `play`, then it arrives with `entrance`; already in place
// when the OS asks for reduced motion.
export function BuyersStamp({
  entrance,
  ...props
}: StampProps & { entrance: StampEntrance }) {
  const reducedMotion = useReducedMotion()
  if (reducedMotion)
    return <StampBody label={props.label} lines={props.lines} />
  const Entrance = ENTRANCES[entrance % ENTRANCES.length]
  return <Entrance {...props} />
}

// The stamp at rest, with slots for each entrance to animate.
function StampBody({
  label,
  lines,
  cardStyle,
  frameStyle,
  sealStyle,
  sealOverlay,
  wrapLine = (_, node) => node,
}: {
  label: string
  lines: ReactNode[]
  cardStyle?: object
  frameStyle?: object
  sealStyle?: object
  sealOverlay?: ReactNode
  wrapLine?: (i: number, node: ReactNode) => ReactNode
}) {
  return (
    <Animated.View
      className="mt-8 max-w-[80%] flex-row items-center gap-3 self-end px-3 py-2"
      style={[{ transform: [{ rotate: `${TILT}deg` }] }, cardStyle]}
    >
      {/* Its own layer, so it can unroll behind the seal. */}
      <Animated.View
        pointerEvents="none"
        className="absolute inset-0 rounded-xl border-2 border-dashed border-garland-ink-40"
        style={frameStyle}
      />
      <View style={{ width: SEAL, height: SEAL }}>
        {sealOverlay}
        <Animated.View style={sealStyle}>
          <BuyerSeal size={SEAL} />
        </Animated.View>
      </View>
      <View className="shrink">
        {wrapLine(
          0,
          <Text className="text-[10px] font-bold uppercase tracking-[1.5px] text-garland-ink-60">
            {label}
          </Text>,
        )}
        {lines.map((line, i) => (
          <View key={i}>{wrapLine(i + 1, line)}</View>
        ))}
      </View>
    </Animated.View>
  )
}

// The label and names rising in one after another: one clock (ms) from 0
// to the last line's end; each line eases in over LINE_MS from its start.
const LINE_MS = 260

function useLineClock(
  count: number,
  play: boolean,
  start: number,
  step: number,
) {
  const clock = useSharedValue(0)
  const end = start + (count - 1) * step + LINE_MS
  useEffect(() => {
    if (play)
      clock.set(withTiming(end, { duration: end, easing: Easing.linear }))
  }, [play, clock, end])
  return function wrapLine(i: number, node: ReactNode) {
    return (
      <LineReveal clock={clock} from={start + i * step}>
        {node}
      </LineReveal>
    )
  }
}

function LineReveal({
  clock,
  from,
  children,
}: {
  clock: SharedValue<number>
  from: number
  children: ReactNode
}) {
  const style = useAnimatedStyle(() => {
    const t = Math.min(1, Math.max(0, (clock.get() - from) / LINE_MS))
    const p = 1 - Math.pow(1 - t, 3)
    return { opacity: p, transform: [{ translateY: (1 - p) * 8 }] }
  })
  return <Animated.View style={style}>{children}</Animated.View>
}

// Slam: brought down hard from above, squashing on impact, ink spattering
// from under the seal.
function SlamStamp({ label, lines, play }: StampProps) {
  const fall = useSharedValue(0)
  const squash = useSharedValue(1)
  const splat = useSharedValue(0)
  useEffect(() => {
    if (!play) return
    fall.set(withTiming(1, { duration: 230, easing: Easing.in(Easing.quad) }))
    squash.set(
      withDelay(
        230,
        withSequence(
          withTiming(0.92, { duration: 70 }),
          withSpring(1, { damping: 7, stiffness: 260 }),
        ),
      ),
    )
    splat.set(
      withDelay(
        220,
        withTiming(1, { duration: 520, easing: Easing.out(Easing.quad) }),
      ),
    )
  }, [play, fall, squash, splat])

  const cardStyle = useAnimatedStyle(() => {
    const f = fall.get()
    return {
      opacity: Math.min(1, f * 3),
      transform: [
        { rotate: `${TILT - (1 - f) * 14}deg` },
        { scale: (2.6 - 1.6 * f) * squash.get() },
      ],
    }
  })
  return (
    <StampBody
      label={label}
      lines={lines}
      cardStyle={cardStyle}
      sealOverlay={<Spatter progress={splat} />}
    />
  )
}

// Directions (degrees) the drops fly off in.
const DROPS = [0, 40, 85, 130, 170, 215, 255, 300, 335]

function Spatter({ progress }: { progress: SharedValue<number> }) {
  return (
    <View
      pointerEvents="none"
      className="absolute"
      style={{ left: SEAL / 2, top: SEAL / 2 }}
    >
      {DROPS.map((deg, i) => (
        <Drop
          key={deg}
          angle={(deg * Math.PI) / 180}
          reach={30 + (i % 3) * 10}
          size={3 + (i % 3)}
          progress={progress}
        />
      ))}
    </View>
  )
}

function Drop({
  angle,
  reach,
  size,
  progress,
}: {
  angle: number
  reach: number
  size: number
  progress: SharedValue<number>
}) {
  const style = useAnimatedStyle(() => {
    const p = progress.get()
    return {
      opacity: p === 0 ? 0 : 1 - p,
      transform: [
        { translateX: Math.cos(angle) * reach * p - size / 2 },
        { translateY: Math.sin(angle) * reach * p - size / 2 },
        { scale: 1.4 - p * 0.6 },
      ],
    }
  })
  return (
    <Animated.View
      className="absolute rounded-full"
      style={[
        { width: size, height: size, backgroundColor: garland.ink },
        style,
      ]}
    />
  )
}

// Roll: the seal rolls in from the right, the frame unrolls behind it, then
// the label and names rise in.
const ROLL_DISTANCE = 240

function RollStamp({ label, lines, play }: StampProps) {
  const roll = useSharedValue(0)
  const unfurl = useSharedValue(0)
  const wrapLine = useLineClock(lines.length + 1, play, 620, 90)
  useEffect(() => {
    if (!play) return
    roll.set(withSpring(1, { damping: 14, stiffness: 120 }))
    unfurl.set(
      withDelay(
        380,
        withTiming(1, { duration: 360, easing: Easing.out(Easing.back(1.4)) }),
      ),
    )
  }, [play, roll, unfurl])

  const sealStyle = useAnimatedStyle(() => {
    const x = (1 - roll.get()) * ROLL_DISTANCE
    return {
      transform: [
        { translateX: x },
        // Rolling, not sliding: one turn per circumference travelled.
        { rotate: `${(x / (Math.PI * SEAL)) * 360}deg` },
      ],
    }
  })
  const frameStyle = useAnimatedStyle(() => ({
    opacity: unfurl.get() > 0 ? 1 : 0,
    transformOrigin: 'left',
    transform: [{ scaleX: unfurl.get() }],
  }))
  return (
    <StampBody
      label={label}
      lines={lines}
      wrapLine={wrapLine}
      sealStyle={sealStyle}
      frameStyle={frameStyle}
    />
  )
}

// Ink pulse: pressed into the page, the seal sending out two rings of ink,
// then the label and names rise in.
function InkPulseStamp({ label, lines, play }: StampProps) {
  const appear = useSharedValue(0)
  const press = useSharedValue(1)
  const ring1 = useSharedValue(0)
  const ring2 = useSharedValue(0)
  const wrapLine = useLineClock(lines.length + 1, play, 420, 110)
  useEffect(() => {
    if (!play) return
    appear.set(
      withTiming(1, { duration: 260, easing: Easing.out(Easing.quad) }),
    )
    press.set(
      withDelay(
        180,
        withSequence(
          withTiming(1.3, { duration: 140, easing: Easing.out(Easing.quad) }),
          withTiming(0.86, { duration: 110, easing: Easing.in(Easing.quad) }),
          withSpring(1, { damping: 8, stiffness: 220 }),
        ),
      ),
    )
    const ring = { duration: 900, easing: Easing.out(Easing.cubic) }
    ring1.set(withDelay(430, withTiming(1, ring)))
    ring2.set(withDelay(620, withTiming(1, ring)))
  }, [play, appear, press, ring1, ring2])

  const cardStyle = useAnimatedStyle(() => ({
    opacity: appear.get(),
    transform: [
      { rotate: `${TILT}deg` },
      { scale: 0.88 + 0.12 * appear.get() },
    ],
  }))
  const sealStyle = useAnimatedStyle(() => ({
    transform: [{ scale: press.get() }],
  }))
  return (
    <StampBody
      label={label}
      lines={lines}
      wrapLine={wrapLine}
      cardStyle={cardStyle}
      sealStyle={sealStyle}
      sealOverlay={
        <>
          <Ring progress={ring1} />
          <Ring progress={ring2} />
        </>
      }
    />
  )
}

function Ring({ progress }: { progress: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const p = progress.get()
    return {
      opacity: p === 0 ? 0 : 0.55 * (1 - p),
      transform: [{ scale: 1 + p * 1.8 }],
    }
  })
  return (
    <Animated.View
      pointerEvents="none"
      className="absolute rounded-full"
      style={[
        { width: SEAL, height: SEAL, borderWidth: 2, borderColor: garland.ink },
        style,
      ]}
    />
  )
}

// Swing: hung by its corner like a gift tag, swinging down into place, the
// seal popping once it settles.
function SwingStamp({ label, lines, play }: StampProps) {
  const drop = useSharedValue(0)
  const swing = useSharedValue(38)
  const pop = useSharedValue(1)
  useEffect(() => {
    if (!play) return
    drop.set(withTiming(1, { duration: 280, easing: Easing.out(Easing.quad) }))
    // Under-damped: it overshoots and settles like a tag on a string.
    swing.set(withSpring(TILT, { damping: 4, stiffness: 90, mass: 0.8 }))
    pop.set(
      withDelay(
        900,
        withSequence(
          withTiming(1.25, { duration: 120 }),
          withSpring(1, { damping: 6, stiffness: 240 }),
        ),
      ),
    )
  }, [play, drop, swing, pop])

  const cardStyle = useAnimatedStyle(() => ({
    opacity: drop.get(),
    transformOrigin: 'right top',
    transform: [
      { translateY: (1 - drop.get()) * -36 },
      { rotate: `${swing.get()}deg` },
    ],
  }))
  const sealStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pop.get() }],
  }))
  return (
    <StampBody
      label={label}
      lines={lines}
      cardStyle={cardStyle}
      sealStyle={sealStyle}
    />
  )
}
