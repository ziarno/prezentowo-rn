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

export type CreateEventArgs = {
  title: string
  date: string
  participants: EventParticipantInput[]
}

export type EventDoc = {
  _id: string
  title: string
  date: string
  ownerId: string
  participants: EventParticipant[]
  createdAt: Date
}

export type ImageRef =
  | { kind: 'upload'; id: string } // self-hosted upload
  | { kind: 'illustration'; id: string } // bundled stock key, e.g. "p3" or "b2"

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
