import Svg, { Circle, Line, Path } from 'react-native-svg'

type SvgIconProps = {
  stroke?: string
  fill?: string
  width?: number
  height?: number
  size?: number
}

export function GlobeIcon({ stroke = '#1d1a14', width, height, size }: SvgIconProps) {
  const w = size ?? width ?? 20
  const h = size ?? height ?? 20
  return (
    <Svg width={w} height={h} viewBox="0 0 24 24" fill="none">
      <Circle
        cx={12}
        cy={12}
        r={10}
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Line
        x1={2}
        y1={12}
        x2={22}
        y2={12}
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <Path
        d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  )
}
