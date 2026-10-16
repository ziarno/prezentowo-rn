import { View } from 'react-native'
import Svg, { Circle, Path } from 'react-native-svg'

import { garland } from '@/constants/colors'

const BUMPS = 14

// Material's `attach_money` glyph (Apache 2.0): a `$` in a 24-unit box,
// centred on (12, 12) and 18 units tall. A path, not text, so it sits dead
// centre whatever the font's metrics.
const DOLLAR =
  'M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z'

// A scalloped wax seal with a `$`: someone is buying this present, however
// many. Decorative — the buyers are always named beside it. Never rendered
// for the present's recipient (claim-quietly rule).
export function BuyerSeal({ size = 26 }: { size?: number }) {
  const r = size / 2
  const rim = Array.from({ length: BUMPS * 2 }, (_, i) => {
    const a = (Math.PI * i) / BUMPS
    const rr = i % 2 === 0 ? r : r * 0.86
    return `${i === 0 ? 'M' : 'L'}${r + rr * Math.cos(a)},${r + rr * Math.sin(a)}`
  }).join(' ')
  // The glyph is ~44% of the seal's height.
  const scale = (size * 0.44) / 18
  return (
    <View
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={{ width: size, height: size }}
    >
      <Svg width={size} height={size}>
        <Path d={`${rim} Z`} fill={garland.ink} />
        <Circle
          cx={r}
          cy={r}
          r={r * 0.66}
          fill="none"
          stroke="rgba(255,250,242,0.45)"
          strokeWidth={Math.max(0.8, size / 40)}
        />
        <Path
          d={DOLLAR}
          fill={garland.paper}
          stroke={garland.paper}
          strokeWidth={0.6}
          strokeLinejoin="round"
          transform={`translate(${r - 12 * scale} ${r - 12 * scale}) scale(${scale})`}
        />
      </Svg>
    </View>
  )
}
