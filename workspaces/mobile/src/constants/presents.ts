import type { ImageSourcePropType } from 'react-native'

import p1 from '@/assets/images/presents/p1-200px.png'
import p2 from '@/assets/images/presents/p2-200px.png'
import p3 from '@/assets/images/presents/p3-200px.png'
import p4 from '@/assets/images/presents/p4-200px.png'
import p5 from '@/assets/images/presents/p5-200px.png'
import p6 from '@/assets/images/presents/p6-200px.png'
import p7 from '@/assets/images/presents/p7-200px.png'
import p8 from '@/assets/images/presents/p8-200px.png'
import p9 from '@/assets/images/presents/p9-200px.png'
import p10 from '@/assets/images/presents/p10-200px.png'
import p11 from '@/assets/images/presents/p11-200px.png'
import p12 from '@/assets/images/presents/p12-200px.png'
import p13 from '@/assets/images/presents/p13-200px.png'
import p14 from '@/assets/images/presents/p14-200px.png'
import p15 from '@/assets/images/presents/p15-200px.png'
import p16 from '@/assets/images/presents/p16-200px.png'
import p17 from '@/assets/images/presents/p17-200px.png'
import p18 from '@/assets/images/presents/p18-200px.png'
import p19 from '@/assets/images/presents/p19-200px.png'
import p20 from '@/assets/images/presents/p20-200px.png'

export const PRESENT_SOURCES = {
  p1,
  p2,
  p3,
  p4,
  p5,
  p6,
  p7,
  p8,
  p9,
  p10,
  p11,
  p12,
  p13,
  p14,
  p15,
  p16,
  p17,
  p18,
  p19,
  p20,
} as const

export type PresentKey = keyof typeof PRESENT_SOURCES

export const PRESENT_KEYS = Object.keys(PRESENT_SOURCES) as PresentKey[]

export const isPresentKey = (key: string | undefined): key is PresentKey =>
  !!key && key in PRESENT_SOURCES

// Resolves a present image source by key, falling back to the first present so
// a gift always renders something even if its `image` is missing or unknown.
export const present = (key: string | undefined): ImageSourcePropType =>
  isPresentKey(key) ? PRESENT_SOURCES[key] : PRESENT_SOURCES.p1
