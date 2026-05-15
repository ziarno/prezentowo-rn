import Svg, { Circle, G, Path, Rect } from 'react-native-svg'

import { garland } from '@/constants/garland'

type Kind = 'intro' | 'wishlist' | 'claim'

type Props = {
  kind: Kind
}

const stroke = garland.green
const accent = garland.amber
const berry = garland.berry
const ink2 = garland.ink60

export function OnboardingIllustration({ kind }: Props) {
  if (kind === 'intro') {
    return (
      <Svg viewBox="0 0 220 200" width={220} height={200} fill="none">
        <G
          stroke={stroke}
          strokeWidth={1.3}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* gift A */}
          <Rect x={22} y={100} width={64} height={60} rx={5} />
          <Path d="M16 95 H92 V112 H16 Z" />
          <Path d="M54 95 V160" />
          <Path d="M54 95 c-8 0 -18 -4 -18 -13 c0 -9 12 -7 18 13 z" />
          <Path d="M54 95 c8 0 18 -4 18 -13 c0 -9 -12 -7 -18 13 z" />
          {/* gift B (tall, middle) */}
          <Rect x={86} y={70} width={50} height={90} rx={5} />
          <Path d="M82 65 H140 V82 H82 Z" />
          <Path d="M111 65 V160" />
          <Path d="M111 65 c-6 0 -14 -3 -14 -10 c0 -7 10 -5 14 10 z" />
          <Path d="M111 65 c6 0 14 -3 14 -10 c0 -7 -10 -5 -14 10 z" />
          {/* gift C */}
          <Rect x={136} y={110} width={60} height={50} rx={5} />
          <Path d="M132 105 H200 V120 H132 Z" />
          <Path d="M166 105 V160" />
          <Path d="M166 105 c-7 0 -16 -3 -16 -11 c0 -8 11 -6 16 11 z" />
          <Path d="M166 105 c7 0 16 -3 16 -11 c0 -8 -11 -6 -16 11 z" />
        </G>
        {/* sparkles */}
        <Path
          d="M30 30 l3 6 l6 3 l-6 3 l-3 6 l-3 -6 l-6 -3 l6 -3 z"
          fill={accent}
        />
        <Path
          d="M190 40 l2 4 l4 2 l-4 2 l-2 4 l-2 -4 l-4 -2 l4 -2 z"
          fill={accent}
        />
        <Path
          d="M180 175 l2 4 l4 2 l-4 2 l-2 4 l-2 -4 l-4 -2 l4 -2 z"
          fill={accent}
        />
      </Svg>
    )
  }

  if (kind === 'wishlist') {
    return (
      <Svg viewBox="0 0 220 200" width={220} height={200} fill="none">
        <G
          stroke={stroke}
          strokeWidth={1.3}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <Rect x={58} y={14} width={104} height={172} rx={14} />
          <Rect
            x={86}
            y={20}
            width={48}
            height={4}
            rx={2}
            fill={stroke}
            stroke="none"
          />
          {/* list rows */}
          <Rect x={68} y={38} width={84} height={36} rx={6} />
          <Rect x={76} y={46} width={20} height={20} rx={4} />
          <Path d="M104 50 H140" />
          <Path d="M104 58 H128" opacity={0.5} />
          <Rect x={68} y={82} width={84} height={36} rx={6} />
          <Rect x={76} y={90} width={20} height={20} rx={4} />
          <Path d="M104 94 H140" />
          <Path d="M104 102 H132" opacity={0.5} />
          <Rect x={68} y={126} width={84} height={36} rx={6} />
          <Rect x={76} y={134} width={20} height={20} rx={4} />
          <Path d="M104 138 H140" />
          <Path d="M104 146 H124" opacity={0.5} />
          {/* FAB */}
          <Circle cx={148} cy={172} r={11} fill={stroke} stroke="none" />
          <Path
            d="M148 167 V177 M143 172 H153"
            stroke={garland.paper}
            strokeWidth={1.5}
          />
        </G>
        <Path
          d="M28 80 l3 6 l6 3 l-6 3 l-3 6 l-3 -6 l-6 -3 l6 -3 z"
          fill={accent}
        />
        <Path
          d="M186 110 l2 4 l4 2 l-4 2 l-2 4 l-2 -4 l-4 -2 l4 -2 z"
          fill={accent}
        />
      </Svg>
    )
  }

  // claim
  return (
    <Svg viewBox="0 0 220 200" width={220} height={200} fill="none">
      <G
        stroke={stroke}
        strokeWidth={1.3}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <Rect x={50} y={80} width={120} height={100} rx={6} />
        <Path d="M40 75 H180 V100 H40 Z" />
        <Path d="M110 75 V180" />
        <Path d="M110 75 c-12 0 -28 -6 -28 -20 c0 -14 18 -10 28 20 z" />
        <Path d="M110 75 c12 0 28 -6 28 -20 c0 -14 -18 -10 -28 20 z" />
        {/* keyhole */}
        <Circle cx={110} cy={130} r={11} />
        <Path d="M110 134 v10" />
      </G>
      {/* crossed-out eye */}
      <G
        stroke={ink2}
        strokeWidth={1.3}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <Path d="M168 30 c10 0 18 8 22 14 c-4 6 -12 14 -22 14 c-10 0 -18 -8 -22 -14 c4 -6 12 -14 22 -14 z" />
        <Circle cx={168} cy={44} r={5} />
        <Path d="M146 22 L190 66" stroke={berry} strokeWidth={1.6} />
      </G>
      <Path
        d="M30 150 l3 6 l6 3 l-6 3 l-3 6 l-3 -6 l-6 -3 l6 -3 z"
        fill={accent}
      />
    </Svg>
  )
}
