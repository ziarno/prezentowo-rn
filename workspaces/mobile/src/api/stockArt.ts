import {
  BACKGROUND_ILLUSTRATION_IDS,
  type BackgroundIllustrationId,
  PRESENT_ILLUSTRATION_IDS,
  type PresentIllustrationId,
} from '@prezentowo/types'

import { type DraftImage, isPhoto } from './draftImage'
import { stablePick } from './eventList'

// What cover text sits on: `light` patterns take ink, `dark` ones paper.
export type BackgroundTone = 'light' | 'dark'

// An event cover's tone: its stock background's, or `photo`.
export type CoverTone = BackgroundTone | 'photo'

const DARK_BACKGROUNDS: readonly BackgroundIllustrationId[] = [
  'b5',
  'b8',
  'b9',
  'b14',
  'b17',
]

// The chosen stock art when `image` names one from `ids`, else the fallback
// (docs/spec.md §1.1): a stable pick hashed from the document's `seed`.
function stockArt<Id extends string>(
  ids: readonly Id[],
  image: DraftImage | undefined,
  seed: string,
): Id {
  const chosen = image?.kind === 'illustration' ? image.id : undefined
  return (ids as readonly string[]).includes(chosen ?? '')
    ? (chosen as Id)
    : stablePick(seed, ids)
}

// The present illustration a gift shows, seeded by the gift `_id`.
export const presentArt = (
  image: DraftImage | undefined,
  giftId: string,
): PresentIllustrationId => stockArt(PRESENT_ILLUSTRATION_IDS, image, giftId)

// The stock background an event shows, seeded by the event `_id`.
export const backgroundArt = (
  background: DraftImage | undefined,
  eventId: string,
): BackgroundIllustrationId =>
  stockArt(BACKGROUND_ILLUSTRATION_IDS, background, eventId)

export const backgroundTone = (id: BackgroundIllustrationId): BackgroundTone =>
  DARK_BACKGROUNDS.includes(id) ? 'dark' : 'light'

// What an event's cover text sits on: a photo, which takes a scrim, or the
// tone of its stock background.
export const coverTone = (
  background: DraftImage | undefined,
  eventId: string,
): CoverTone =>
  isPhoto(background)
    ? 'photo'
    : backgroundTone(backgroundArt(background, eventId))
