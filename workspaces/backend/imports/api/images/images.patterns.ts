import type { ImageRef } from '@prezentowo/types'
import { Match, check } from 'meteor/check'

export const imageRefPattern = Match.Where(
  (value: unknown): value is ImageRef => {
    check(value, { kind: String, id: String })
    const { kind, id } = value as ImageRef
    return (kind === 'upload' || kind === 'illustration') && id.length > 0
  },
)
