import type { ImageSourcePropType } from 'react-native'

import f1 from '@/assets/images/avatars/f1.png'
import f2 from '@/assets/images/avatars/f2.png'
import f3 from '@/assets/images/avatars/f3.png'
import f4 from '@/assets/images/avatars/f4.png'
import m1 from '@/assets/images/avatars/m1.png'
import m2 from '@/assets/images/avatars/m2.png'
import m3 from '@/assets/images/avatars/m3.png'
import m4 from '@/assets/images/avatars/m4.png'

export const AVATAR_SOURCES = { f1, f2, f3, f4, m1, m2, m3, m4 } as const

export type AvatarKey = keyof typeof AVATAR_SOURCES

export const AVATAR_KEYS: readonly AvatarKey[] = [
  'f1',
  'm1',
  'f2',
  'm2',
  'f3',
  'm3',
  'f4',
  'm4',
]

export const avatar = (key: AvatarKey): ImageSourcePropType =>
  AVATAR_SOURCES[key]
