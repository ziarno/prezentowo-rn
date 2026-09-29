import type { ImageSourcePropType } from 'react-native'

import f1 from '@/assets/images/avatars/f1.png'
import f2 from '@/assets/images/avatars/f2.png'
import f3 from '@/assets/images/avatars/f3.png'
import f4 from '@/assets/images/avatars/f4.png'
import f5 from '@/assets/images/avatars/f5.png'
import f6 from '@/assets/images/avatars/f6.png'
import f7 from '@/assets/images/avatars/f7.png'
import f8 from '@/assets/images/avatars/f8.png'
import f9 from '@/assets/images/avatars/f9.png'
import f10 from '@/assets/images/avatars/f10.png'
import f11 from '@/assets/images/avatars/f11.png'
import f12 from '@/assets/images/avatars/f12.png'
import m1 from '@/assets/images/avatars/m1.png'
import m2 from '@/assets/images/avatars/m2.png'
import m3 from '@/assets/images/avatars/m3.png'
import m4 from '@/assets/images/avatars/m4.png'
import m5 from '@/assets/images/avatars/m5.png'
import m6 from '@/assets/images/avatars/m6.png'
import m7 from '@/assets/images/avatars/m7.png'
import m8 from '@/assets/images/avatars/m8.png'
import m9 from '@/assets/images/avatars/m9.png'
import m10 from '@/assets/images/avatars/m10.png'
import m11 from '@/assets/images/avatars/m11.png'
import m12 from '@/assets/images/avatars/m12.png'

export const AVATAR_SOURCES = {
  f1,
  f2,
  f3,
  f4,
  f5,
  f6,
  f7,
  f8,
  f9,
  f10,
  f11,
  f12,
  m1,
  m2,
  m3,
  m4,
  m5,
  m6,
  m7,
  m8,
  m9,
  m10,
  m11,
  m12,
} as const

export type AvatarKey = keyof typeof AVATAR_SOURCES

export type AvatarGender = 'female' | 'male'

export const FEMALE_AVATAR_KEYS: readonly AvatarKey[] = [
  'f1',
  'f2',
  'f3',
  'f4',
  'f5',
  'f6',
  'f7',
  'f8',
  'f9',
  'f10',
  'f11',
  'f12',
]

export const MALE_AVATAR_KEYS: readonly AvatarKey[] = [
  'm1',
  'm2',
  'm3',
  'm4',
  'm5',
  'm6',
  'm7',
  'm8',
  'm9',
  'm10',
  'm11',
  'm12',
]

export const AVATAR_KEYS: readonly AvatarKey[] = [
  ...FEMALE_AVATAR_KEYS,
  ...MALE_AVATAR_KEYS,
]

export const isAvatarKey = (key: string | undefined): key is AvatarKey =>
  !!key && key in AVATAR_SOURCES

export const avatarGender = (key: AvatarKey): AvatarGender =>
  key.startsWith('f') ? 'female' : 'male'

export const avatarKeysForGender = (
  gender: AvatarGender,
): readonly AvatarKey[] =>
  gender === 'female' ? FEMALE_AVATAR_KEYS : MALE_AVATAR_KEYS

export const avatar = (key: AvatarKey): ImageSourcePropType =>
  AVATAR_SOURCES[key]
