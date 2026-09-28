import Svg, { Circle, Path, Rect } from 'react-native-svg'

type IconProps = {
  width?: number
  height?: number
  color?: string
}

type StrokeIconProps = IconProps & {
  d: string
  strokeWidth: number
  extra?: React.ReactNode
}

function StrokeIcon({
  width = 24,
  height = 24,
  color = 'currentColor',
  d,
  strokeWidth,
  extra,
}: StrokeIconProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
      <Path
        d={d}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {extra}
    </Svg>
  )
}

export function GlobeIcon(props: IconProps) {
  return (
    <StrokeIcon
      {...props}
      strokeWidth={1.5}
      d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0zM3 12h18M12 3a15.3 15.3 0 0 1 4 9 15.3 15.3 0 0 1-4 9 15.3 15.3 0 0 1-4-9 15.3 15.3 0 0 1 4-9z"
    />
  )
}

export function BellIcon(props: IconProps) {
  return (
    <StrokeIcon
      {...props}
      strokeWidth={1.6}
      d="M6 8a6 6 0 1 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9zM10 21a2 2 0 0 0 4 0"
    />
  )
}

export function ChevronIcon(props: IconProps) {
  return <StrokeIcon {...props} strokeWidth={1.6} d="M9 6l6 6-6 6" />
}

export function LockIcon({
  width = 24,
  height = 24,
  color = 'currentColor',
}: IconProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
      <Rect
        x={4}
        y={11}
        width={16}
        height={10}
        rx={2}
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M8 11V7a4 4 0 1 1 8 0v4"
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

export function PlusIcon(props: IconProps) {
  return <StrokeIcon {...props} strokeWidth={2} d="M12 5v14M5 12h14" />
}

export function BackIcon(props: IconProps) {
  return <StrokeIcon {...props} strokeWidth={1.8} d="M15 18l-6-6 6-6" />
}

export function ArrowRightIcon(props: IconProps) {
  return <StrokeIcon {...props} strokeWidth={1.2} d="M5 12h14M13 6l6 6-6 6" />
}

export function CloseIcon(props: IconProps) {
  return <StrokeIcon {...props} strokeWidth={1.8} d="M6 6l12 12M18 6l-12 12" />
}

export function CheckIcon(props: IconProps) {
  return <StrokeIcon {...props} strokeWidth={2} d="M5 13l4 4L19 7" />
}

export function MoonIcon(props: IconProps) {
  return (
    <StrokeIcon
      {...props}
      strokeWidth={1.6}
      d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"
    />
  )
}

export function CalendarIcon({
  width = 24,
  height = 24,
  color = 'currentColor',
}: IconProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
      <Rect
        x={3}
        y={5}
        width={18}
        height={16}
        rx={2}
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M8 3v4M16 3v4M3 10h18"
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

export function HeartIcon(props: IconProps) {
  return (
    <StrokeIcon
      {...props}
      strokeWidth={1.6}
      d="M12 21s-7-4.5-9.5-9C1 9 2.5 5 6.5 5c2 0 3.5 1.2 5.5 3.5C13.9 6.2 15.5 5 17.5 5c4 0 5.5 4 4 7-2.5 4.5-9.5 9-9.5 9z"
    />
  )
}

export function PencilIcon(props: IconProps) {
  return (
    <StrokeIcon
      {...props}
      strokeWidth={1.6}
      d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4"
    />
  )
}

export function HamburgerIcon(props: IconProps) {
  return <StrokeIcon {...props} strokeWidth={1.8} d="M4 7h16M4 12h16M4 17h16" />
}

export function MoreIcon({
  width = 24,
  height = 24,
  color = 'currentColor',
}: IconProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 24 24" fill={color}>
      <Circle cx={5} cy={12} r={1.6} />
      <Circle cx={12} cy={12} r={1.6} />
      <Circle cx={19} cy={12} r={1.6} />
    </Svg>
  )
}

export function LinkIcon(props: IconProps) {
  return (
    <StrokeIcon
      {...props}
      strokeWidth={1.6}
      d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"
    />
  )
}

export function GiftIcon({
  width = 24,
  height = 24,
  color = 'currentColor',
}: IconProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
      <Path
        d="M20 12v9H4v-9"
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Rect
        x={2}
        y={7}
        width={20}
        height={5}
        rx={1}
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M12 22V7M12 7c-1 0-3.5-.5-3.5-2.5S10 2.5 12 7zM12 7c1 0 3.5-.5 3.5-2.5S14 2.5 12 7z"
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

export function ChatIcon(props: IconProps) {
  return (
    <StrokeIcon
      {...props}
      strokeWidth={1.6}
      d="M21 12a8 8 0 0 1-8 8 8 8 0 0 1-3.4-.8L3 21l1.4-5A8 8 0 0 1 5 12a8 8 0 0 1 16 0z"
    />
  )
}
