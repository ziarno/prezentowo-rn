import type { BackgroundIllustrationId } from '@prezentowo/types'
import type { ReactNode } from 'react'
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  Path,
  Pattern,
  Polygon,
  Rect,
} from 'react-native-svg'

import { garland as C } from '@/constants/colors'

// One stock background: a `fill` under a tile repeated at a fixed scale, so
// the pattern draws the same size in `3c`, `3c3` and a picker tile. Ported
// from the accepted drafts (#66); tones live in `api/stockArt`.
type Background = {
  fill: string
  tile: { width: number; height: number; transform?: string }
  body: ReactNode
  opacity?: number
  // How far down the tile repeats, when not the whole area.
  height?: number
}

const star = (cx: number, cy: number, r: number, rot: number) => {
  const points = Array.from({ length: 10 }, (_, i) => {
    const a = ((rot - 90 + i * 36) * Math.PI) / 180
    const rr = i % 2 ? r * 0.45 : r
    return `${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * Math.sin(a)).toFixed(1)}`
  })
  return (
    <Polygon key={`${cx},${cy}`} points={points.join(' ')} fill={C.amber} />
  )
}

const confetti: [
  'c' | 'r' | 's',
  number,
  number,
  number,
  number,
  number,
  string,
][] = [
  ['r', 12, 14, 10, 5, 20, C.green],
  ['c', 44, 30, 4, 0, 0, C.berry],
  ['s', 70, 12, 0, 0, 15, C.amber],
  ['r', 110, 26, 10, 5, -35, C.berry],
  ['c', 128, 64, 3.5, 0, 0, C.green],
  ['r', 86, 56, 9, 5, 60, C.amber],
  ['s', 24, 58, 0, 0, -20, C.berry],
  ['c', 58, 84, 4.5, 0, 0, C.amber],
  ['r', 20, 108, 10, 5, -15, C.amber],
  ['s', 98, 100, 0, 0, 40, C.green],
  ['c', 132, 120, 4, 0, 0, C.berry],
  ['r', 60, 124, 9, 5, 30, C.green],
  ['c', 8, 84, 3, 0, 0, C.green],
  ['r', 120, 96, 8, 4, 10, C.berry],
]

const buntingY = (x: number) => {
  const t = x / 160
  return 10 + 60 * t * (1 - t)
}

const flake = (x: number, y: number, r: number, opacity: number) => (
  <G
    key={`${x},${y}`}
    transform={`translate(${x} ${y})`}
    stroke={C.paper}
    strokeOpacity={opacity}
    strokeWidth={1.6}
    strokeLinecap="round"
  >
    {[0, 60, 120].map(a => (
      <Path key={a} d={`M${-r} 0 L${r} 0`} transform={`rotate(${a})`} />
    ))}
  </G>
)

const bauble = (x: number, len: number, r: number, color: string) => (
  <G key={x}>
    <Path
      d={`M${x} 0 L${x} ${len}`}
      stroke={C.paper}
      strokeOpacity={0.5}
      strokeWidth={1.2}
    />
    <Rect x={x - 3} y={len - 2} width={6} height={5} fill={C.amber} />
    <Circle cx={x} cy={len + r + 2} r={r} fill={color} />
    <Path
      d={`M${x - r * 0.6} ${len + r} q${r * 0.3} ${-r * 0.3} ${r * 0.6} ${-r * 0.4}`}
      stroke={C.paper}
      strokeOpacity={0.6}
      strokeWidth={2}
      fill="none"
      strokeLinecap="round"
    />
  </G>
)

const balloon = (x: number, y: number, color: string, rot: number) => (
  <G key={`${x},${y}`} transform={`rotate(${rot} ${x} ${y})`}>
    <Path
      d={`M${x} ${y + 26} q-5 12 2 22 t-2 22`}
      fill="none"
      stroke={C.ink}
      strokeOpacity={0.3}
      strokeWidth={1.2}
    />
    <Ellipse cx={x} cy={y} rx={17} ry={21} fill={color} />
    <Polygon
      points={`${x - 3},${y + 22} ${x + 3},${y + 22} ${x},${y + 18}`}
      fill={color}
    />
    <Ellipse cx={x - 6} cy={y - 8} rx={4} ry={6} fill="#fff" opacity={0.35} />
  </G>
)

// A small rounded bar: balloon sprinkles and party-hat confetti.
const bit = (
  x: number,
  y: number,
  width: number,
  height: number,
  color: string,
  rot: number,
) => (
  <Rect
    key={`${x},${y}`}
    x={x}
    y={y}
    width={width}
    height={height}
    rx={height / 2}
    fill={color}
    transform={`rotate(${rot} ${x} ${y})`}
  />
)

const heart = (x: number, y: number, s: number, rot: number) => (
  <Path
    key={`${x},${y}`}
    transform={`rotate(${rot} ${x} ${y})`}
    d={`M${x} ${y + s * 0.9} C${x - s * 1.4} ${y} ${x - s * 0.9} ${y - s * 0.9} ${x} ${y - s * 0.3} C${x + s * 0.9} ${y - s * 0.9} ${x + s * 1.4} ${y} ${x} ${y + s * 0.9}Z`}
    fill={C.berry}
  />
)

const sparkle = (x: number, y: number, r: number) => (
  <Path
    key={`${x},${y}`}
    d={`M${x} ${y - r} Q${x} ${y} ${x + r} ${y} Q${x} ${y} ${x} ${y + r} Q${x} ${y} ${x - r} ${y} Q${x} ${y} ${x} ${y - r}Z`}
    fill={C.paper}
    opacity={0.85}
  />
)

const tree = (x: number, y: number, s: number) => (
  <G key={`${x},${y}`}>
    <Rect
      x={x - 3 * s}
      y={y + 34 * s}
      width={6 * s}
      height={8 * s}
      fill={C.berry}
    />
    {[0, 11, 22].map((o, i) => (
      <Polygon
        key={o}
        points={`${x},${y + o * s} ${x + (10 + i * 5) * s},${y + (o + 16) * s} ${x - (10 + i * 5) * s},${y + (o + 16) * s}`}
        fill={C.green}
      />
    ))}
    <Circle cx={x} cy={y - 2 * s} r={3 * s} fill={C.amber} />
  </G>
)

const hat = (x: number, y: number, color: string, rot: number) => (
  <G key={`${x},${y}`} transform={`rotate(${rot} ${x} ${y + 20})`}>
    <Polygon
      points={`${x},${y} ${x + 15},${y + 40} ${x - 15},${y + 40}`}
      fill={color}
    />
    <Path
      d={`M${x - 6} ${y + 16} L${x + 6} ${y + 16} M${x - 11} ${y + 29} L${x + 11} ${y + 29}`}
      stroke={C.paper}
      strokeWidth={3}
    />
    <Circle cx={x} cy={y - 2} r={5} fill={C.amber} />
  </G>
)

const streamer = (x: number, y: number, color: string, rot: number) => (
  <Path
    key={`${x},${y}`}
    transform={`rotate(${rot} ${x} ${y})`}
    d={`M${x} ${y} c8 -12 16 12 24 0 s16 12 24 0 s16 12 24 0`}
    fill="none"
    stroke={color}
    strokeWidth={3.4}
    strokeLinecap="round"
  />
)

const dots = (
  points: [number, number][],
  r: number,
  color: string,
  opacity?: number,
) =>
  points.map(([x, y]) => (
    <Circle
      key={`${x},${y}`}
      cx={x}
      cy={y}
      r={r}
      fill={color}
      opacity={opacity}
    />
  ))

const BACKGROUNDS: Record<BackgroundIllustrationId, Background> = {
  // Dots
  b1: {
    fill: C.paper,
    tile: { width: 28, height: 28 },
    body: dots(
      [
        [7, 7],
        [21, 21],
      ],
      3.6,
      C.green,
    ),
    opacity: 0.55,
  },
  // Candy stripe
  b2: {
    fill: C.paper,
    tile: { width: 34, height: 34, transform: 'rotate(45)' },
    body: <Rect width={15} height={34} fill={C.amber} opacity={0.45} />,
  },
  // Confetti
  b3: {
    fill: C.paper,
    tile: { width: 140, height: 140 },
    body: confetti.map(([kind, x, y, a, b, rot, color]) =>
      kind === 'c' ? (
        <Circle key={`${x},${y}`} cx={x} cy={y} r={a} fill={color} />
      ) : kind === 'r' ? (
        <Rect
          key={`${x},${y}`}
          x={x}
          y={y}
          width={a}
          height={b}
          rx={1.5}
          fill={color}
          transform={`rotate(${rot} ${x} ${y})`}
        />
      ) : (
        <Path
          key={`${x},${y}`}
          d={`M${x} ${y} q5 -6 10 0 t10 0`}
          fill="none"
          stroke={color}
          strokeWidth={2.5}
          strokeLinecap="round"
          transform={`rotate(${rot} ${x} ${y})`}
        />
      ),
    ),
    opacity: 0.8,
  },
  // Bunting
  b4: {
    fill: C.paper,
    tile: { width: 160, height: 64 },
    body: (
      <>
        <Path
          d="M0 10 Q80 40 160 10"
          fill="none"
          stroke={C.ink}
          strokeOpacity={0.35}
          strokeWidth={1.4}
        />
        {[16, 48, 80, 112, 144].map((x, i) => {
          const y0 = buntingY(x - 9)
          const y1 = buntingY(x + 9)
          return (
            <Polygon
              key={x}
              points={`${x - 9},${y0} ${x + 9},${y1} ${x},${(y0 + y1) / 2 + 22}`}
              fill={[C.berry, C.green, C.amber, C.green, C.berry][i]}
            />
          )
        })}
      </>
    ),
    opacity: 0.75,
  },
  // Evergreen field
  b5: {
    fill: C.green,
    tile: { width: 10, height: 10, transform: 'rotate(35)' },
    body: <Rect width={3} height={10} fill="#244a2e" />,
  },
  // Gingham
  b6: {
    fill: C.paper,
    tile: { width: 36, height: 36 },
    body: (
      <>
        <Rect width={18} height={36} fill={C.green} opacity={0.16} />
        <Rect width={36} height={18} fill={C.green} opacity={0.16} />
      </>
    ),
  },
  // Waves
  b7: {
    fill: C.paper,
    tile: { width: 80, height: 22 },
    body: (
      <Path
        d="M0 11 Q20 1 40 11 T80 11"
        fill="none"
        stroke={C.berry}
        strokeOpacity={0.45}
        strokeWidth={2.6}
      />
    ),
  },
  // Snowfall (Christmas)
  b8: {
    fill: C.green,
    tile: { width: 120, height: 120 },
    body: (
      <>
        {flake(20, 24, 8, 0.9)}
        {flake(78, 14, 5, 0.6)}
        {flake(100, 70, 9, 0.85)}
        {flake(44, 88, 6, 0.7)}
        {flake(12, 72, 4, 0.5)}
        {flake(72, 108, 5, 0.6)}
        {dots(
          [
            [56, 46],
            [110, 110],
            [28, 120],
            [96, 34],
          ],
          2.2,
          C.amber,
        )}
      </>
    ),
  },
  // Baubles (Christmas), hanging from the top edge
  b9: {
    fill: C.berry,
    tile: { width: 120, height: 150 },
    body: (
      <>
        {bauble(18, 40, 11, C.amber)}
        {bauble(52, 78, 9, C.green)}
        {bauble(84, 24, 12, C.paper)}
        {bauble(108, 62, 8, C.amber)}
      </>
    ),
    height: 150,
  },
  // Balloons (birthday)
  b10: {
    fill: C.paper,
    tile: { width: 150, height: 150 },
    body: (
      <>
        {balloon(30, 34, C.berry, -8)}
        {balloon(104, 20, C.amber, 6)}
        {balloon(74, 104, C.green, -4)}
        {balloon(136, 118, C.berry, 10)}
        {bit(66, 40, 7, 2.6, C.green, 30)}
        {bit(14, 110, 7, 2.6, C.amber, -40)}
        {bit(120, 76, 7, 2.6, C.berry, 60)}
        {bit(40, 140, 7, 2.6, C.green, 10)}
      </>
    ),
    opacity: 0.85,
  },
  // Stars
  b11: {
    fill: C.paper,
    tile: { width: 100, height: 110 },
    body: (
      <>
        {star(18, 20, 8, 10)}
        {star(64, 14, 5, -12)}
        {star(46, 56, 9, 22)}
        {star(84, 70, 6, 0)}
        {star(16, 78, 5, 30)}
        {dots(
          [
            [38, 30],
            [74, 44],
            [30, 98],
            [70, 96],
          ],
          2,
          C.green,
        )}
      </>
    ),
    opacity: 0.8,
  },
  // Chevron
  b12: {
    fill: C.paper,
    tile: { width: 40, height: 26 },
    body: (
      <Path
        d="M0 19 L20 7 L40 19"
        fill="none"
        stroke={C.green}
        strokeOpacity={0.32}
        strokeWidth={3.2}
        strokeLinejoin="round"
      />
    ),
  },
  // Amber field
  b13: {
    fill: '#dcb56a',
    tile: { width: 30, height: 30 },
    body: dots(
      [
        [7, 7],
        [22, 22],
      ],
      2.6,
      C.paper,
      0.5,
    ),
  },
  // Berry pinstripe
  b14: {
    fill: C.berry,
    tile: { width: 18, height: 18 },
    body: <Rect width={5} height={18} fill="#86301e" />,
  },
  // Scallops
  b15: {
    fill: C.paper,
    tile: { width: 40, height: 40 },
    body: (
      <Path
        d="M0 20 A20 20 0 0 1 40 20 M-20 40 A20 20 0 0 1 20 40 M20 40 A20 20 0 0 1 60 40"
        fill="none"
        stroke={C.green}
        strokeOpacity={0.32}
        strokeWidth={2.2}
      />
    ),
  },
  // Hearts
  b16: {
    fill: C.paper,
    tile: { width: 64, height: 64 },
    body: (
      <>
        {heart(16, 16, 7, -12)}
        {heart(48, 48, 7, 14)}
      </>
    ),
    opacity: 0.5,
  },
  // Night sky
  b17: {
    fill: C.ink,
    tile: { width: 130, height: 130 },
    body: (
      <>
        {sparkle(24, 26, 7)}
        {sparkle(88, 74, 5)}
        {sparkle(116, 14, 4)}
        {sparkle(34, 100, 4)}
        {dots(
          [
            [40, 12],
            [96, 40],
            [18, 64],
            [70, 92],
            [112, 104],
            [52, 118],
          ],
          1.6,
          C.amber,
        )}
      </>
    ),
  },
  // Fir trees (Christmas)
  b18: {
    fill: C.paper,
    tile: { width: 110, height: 120 },
    body: (
      <>
        {tree(28, 14, 1)}
        {tree(82, 66, 0.85)}
        {dots(
          [
            [70, 16],
            [14, 60],
            [100, 92],
            [44, 104],
            [82, 58],
          ],
          2,
          C.green,
          0.35,
        )}
      </>
    ),
    opacity: 0.85,
  },
  // Party hats (birthday)
  b19: {
    fill: C.paper,
    tile: { width: 130, height: 130 },
    body: (
      <>
        {hat(28, 14, C.berry, -10)}
        {hat(96, 64, C.green, 12)}
        {hat(40, 84, C.amber, 4)}
        {bit(76, 22, 8, 3, C.green, 30)}
        {bit(112, 20, 8, 3, C.berry, -40)}
        {bit(10, 70, 8, 3, C.green, 60)}
        {bit(84, 118, 8, 3, C.berry, 10)}
      </>
    ),
    opacity: 0.85,
  },
  // Streamers
  b20: {
    fill: C.paper,
    tile: { width: 160, height: 140 },
    body: (
      <>
        {streamer(10, 24, C.berry, -8)}
        {streamer(90, 50, C.green, 14)}
        {streamer(24, 96, C.amber, 20)}
        {streamer(100, 118, C.berry, -18)}
      </>
    ),
    opacity: 0.6,
  },
}

// A stock background filling its parent.
export function StockBackground({ id }: { id: BackgroundIllustrationId }) {
  const { fill, tile, body, opacity, height } = BACKGROUNDS[id]
  return (
    <Svg width="100%" height="100%">
      <Defs>
        <Pattern
          id="tile"
          patternUnits="userSpaceOnUse"
          width={tile.width}
          height={tile.height}
          patternTransform={tile.transform}
        >
          {body}
        </Pattern>
      </Defs>
      <Rect width="100%" height="100%" fill={fill} />
      <Rect
        width="100%"
        height={height ?? '100%'}
        fill="url(#tile)"
        opacity={opacity}
      />
    </Svg>
  )
}
