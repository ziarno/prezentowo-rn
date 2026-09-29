export type RegisterNewUserArgs = {
  email: string
  password: string
  name: string
}

export type UpdateUserArgs = {
  name?: string
  email?: string
  avatar?: string
}

export type LoginCredentials = {
  id: string
  token: string
}

export type RequestMagicLinkArgs = {
  email: string
}

export type EventParticipantInput =
  | { kind: 'real'; userId: string }
  | { kind: 'placeholder'; name: string; color: string; avatar?: string }

export type EventParticipant =
  | { id: string; kind: 'real'; userId: string }
  | {
      id: string
      kind: 'placeholder'
      name: string
      color: string
      avatar?: string
    }

export type ImageRef =
  | { kind: 'upload'; id: string } // self-hosted upload
  | { kind: 'illustration'; id: string } // bundled stock key, e.g. "p3" or "b2"

// Stock art bundled in the app (docs/spec.md §1.1). Append-only: an id is
// never reused or renumbered. `GiftDoc.image` takes a present id,
// `EventDoc.background` a background id.
export const PRESENT_ILLUSTRATION_IDS = [
  'p1',
  'p2',
  'p3',
  'p4',
  'p5',
  'p6',
  'p7',
  'p8',
  'p9',
  'p10',
  'p11',
  'p12',
  'p13',
  'p14',
  'p15',
  'p16',
  'p17',
  'p18',
  'p19',
  'p20',
  'p21',
  'p22',
  'p23',
  'p24',
  'p25',
  'p26',
  'p27',
  'p28',
  'p29',
  'p30',
  'p31',
  'p32',
  'p33',
  'p34',
  'p35',
  'p36',
  'p37',
  'p38',
  'p39',
  'p40',
] as const
export const BACKGROUND_ILLUSTRATION_IDS = [
  'b1',
  'b2',
  'b3',
  'b4',
  'b5',
  'b6',
  'b7',
  'b8',
  'b9',
  'b10',
  'b11',
  'b12',
  'b13',
  'b14',
  'b15',
  'b16',
  'b17',
  'b18',
  'b19',
  'b20',
] as const

export type PresentIllustrationId = (typeof PRESENT_ILLUSTRATION_IDS)[number]
export type BackgroundIllustrationId =
  (typeof BACKGROUND_ILLUSTRATION_IDS)[number]

export type EventKind =
  | { type: 'many-to-many' }
  // An EventParticipant.id, never a userId: the beneficiary may be a
  // placeholder.
  | { type: 'many-to-one'; beneficiaryParticipantId: string }

// Participant ids are minted server-side, so create names the beneficiary by
// index into `participants`.
export type CreateEventKindInput =
  | { type: 'many-to-many' }
  | { type: 'many-to-one'; beneficiaryIndex: number }

export type CreateEventArgs = {
  title: string
  // A calendar date, `YYYY-MM-DD`.
  date: string
  background?: ImageRef
  // The caller is always the host and is added if missing; a `real` entry
  // for them marks where they sit for `beneficiaryIndex`.
  participants: EventParticipantInput[]
} & CreateEventKindInput

export type EventDoc = {
  _id: string
  title: string
  date: string
  background?: ImageRef
  ownerId: string
  participants: EventParticipant[]
  createdAt: Date
} & EventKind

export type UpdateEventArgs = {
  eventId: string
  title?: string
  date?: string
  // null clears it.
  background?: ImageRef | null
  // Rejected once any GiftDoc exists for the event.
  kind?: EventKind
}

export type InviteDoc = {
  _id: string
  // 4 chars, crypto-random, alphabet = [A-Za-z0-9] minus 0 O 1 l I (57
  // symbols). Unique.
  code: string
  // Exactly one InviteDoc per event.
  eventId: string
  ownerId: string
  createdAt: Date
}

// The WebP derivatives of an upload, by long edge in px, served at
// `/images/<id>/<size>.webp`: 400 present tile, 1000 present detail, 1600
// event cover.
export type ImageSize = 400 | 1000 | 1600

// `POST /api/images` (single-file multipart) responds 200 with this.
export type UploadImageResult = { id: string }

// `POST /api/images` responds `{ error: UploadImageErrorCode }` with 400
// (`expectedOneFile`), 413 (`tooLarge`) or 415 (`notAnImage`). A missing or
// invalid login token is a 401 from the auth middleware.
export type UploadImageErrorCode = 'expectedOneFile' | 'tooLarge' | 'notAnImage'

export type GiftDoc = {
  _id: string
  eventId: string
  // The recipient (by EventParticipant.id). Write-once.
  forParticipantId: string
  title: string
  description?: string
  url?: string
  image?: ImageRef
  // userIds who have reserved this gift. Stripped for the recipient by the
  // gifts.byEvent publication — the claim-quietly rule.
  claimedBy: string[]
  // userId. Write-once.
  createdBy: string
  createdAt: Date
}

export type AddGiftArgs = {
  eventId: string
  forParticipantId: string
  title: string
  description?: string
  url?: string
  image?: ImageRef
  // Idempotency key for offline replay: a repeat (createdBy, clientId)
  // returns the existing gift instead of inserting a duplicate.
  clientId?: string
}

export type UpdateGiftArgs = {
  giftId: string
  title?: string
  description?: string
  url?: string
  // null clears; undefined leaves unchanged.
  image?: ImageRef | null
}
