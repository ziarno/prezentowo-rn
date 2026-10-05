export type RegisterNewUserArgs = {
  email: string
  password: string
  name: string
}

// A user's picture is `profile.photo` when set, else the stock
// `profile.avatar` (docs/spec.md §1.10).
export type UpdateUserArgs = {
  name?: string
  email?: string
  // A stock avatar key, e.g. "f3".
  avatar?: string
  // An upload id. null clears it; undefined leaves it unchanged.
  photo?: string | null
}

export type LoginCredentials = {
  id: string
  token: string
}

export type RequestMagicLinkArgs = {
  email: string
}

export type EventParticipantInput =
  // Only ever the caller: nobody is made a member of someone else's event
  // without accepting, so any other userId is rejected.
  | { kind: 'real'; userId: string }
  // A user found by `users.search`; becomes a reserved placeholder.
  | { kind: 'invited'; userId: string; color: string }
  // `photo` is the caller's own upload id, attached on create (§1.11).
  | {
      kind: 'placeholder'
      name: string
      color: string
      avatar?: string
      photo?: string
    }

export type EventParticipant =
  | { id: string; kind: 'real'; userId: string }
  | {
      id: string
      kind: 'placeholder'
      name: string
      color: string
      // A stock avatar key. A reserved placeholder snapshots its invitee's.
      avatar?: string
      // An upload id the creator gave a placeholder added by name, shown
      // instead of `avatar` (docs/spec.md §1.11). Never on a reserved one.
      photo?: string
      // Set = a reserved placeholder: only this user can claim it, by
      // joining. Server-only, never published.
      invitedUserId?: string
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

// `6a`'s remove: `participantId` is the EventParticipant.id, real or
// placeholder.
export type RemoveParticipantArgs = { eventId: string; participantId: string }

// The creator's edit of a placeholder's picture (docs/spec.md §1.11). Like
// `UpdateUserArgs`: picking a stock avatar sends `{ avatar, photo: null }`.
export type UpdateParticipantArgs = {
  eventId: string
  participantId: string
  // A stock avatar key, e.g. "f3".
  avatar?: string
  // An upload id. null clears it; undefined leaves it unchanged.
  photo?: string | null
}

// `participantId` names the placeholder being claimed; without it the caller
// joins as a new participant. The invite code is the only join capability.
export type JoinEventArgs = { code: string; participantId?: string }

export type JoinEventResult = { eventId: string }

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

// What a signed-out or not-yet-member viewer may see of an event on `7a` and
// the web landing page. Never carries a userId or any gift.
export type InvitePreview = {
  code: string
  eventId: string
  title: string
  date: string
  background?: ImageRef
  inviterName: string
  // Who's already taking part: the real participants, by name, avatar key
  // and photo.
  realParticipants: {
    id: string
    name: string
    avatar?: string
    photo?: string
  }[]
  // Reserved placeholders are left out, except the viewer's own, which
  // carries `reservedForYou` (so none are listed signed out).
  unclaimedPlaceholders: {
    id: string
    name: string
    color: string
    avatar?: string
    photo?: string
    reservedForYou?: true
  }[]
}

// The WebP derivatives of an upload, by long edge in px, served at
// `/images/<id>/<size>.webp`: 400 present tile and profile or placeholder
// photo, 1000 present detail, 1600 event cover.
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

// One already-occurred thing in an event's history, shown on Home and the
// event feed. Every field is a snapshot taken at write time.
export type ActivityDoc = {
  _id: string
  eventId: string
  kind:
    | 'gift-added'
    | 'gift-claimed'
    | 'gift-unclaimed'
    | 'participant-joined'
  // EventParticipant.id of who did it.
  actorParticipantId: string
  createdAt: Date
  // gift-* only.
  giftId?: string
  giftTitle?: string
  recipientParticipantId?: string
  // The participant who must never see this item, decided once at insert
  // and never re-evaluated. Server-only: no publication sends it.
  hiddenFromParticipantId?: string
}

// Something that happened which one user should hear about, in their bell
// inbox. Every field is a snapshot taken at write time.
export type NotificationDoc = {
  _id: string
  // Always an account, never a participant.
  userId: string
  kind:
    | 'invite-deferred'
    | 'invited'
    | 'suggestion-claimed'
    | 'participant-joined'
    | 'claimed-gift-removed'
  createdAt: Date
  read: boolean
  eventId: string
  // suggestion-claimed only.
  giftId?: string
  // suggestion-claimed, claimed-gift-removed.
  giftTitle?: string
  // suggestion-claimed, claimed-gift-removed: whose list to open once the
  // gift is gone.
  recipientParticipantId?: string
  // suggestion-claimed.
  claimedByParticipantId?: string
  // participant-joined.
  joinedParticipantId?: string
}

// An invite waiting in the caller's notifications inbox, set aside with
// Ignore or sent by a creator who added them from `4d`: `invites.deferred`
// publishes one per event with an `invite-deferred` or `invited`, keyed by
// `eventId`. `code` is the event's current one, so it survives a rotate.
export type DeferredInvite = {
  eventId: string
  code: string
  title: string
  inviterName: string
}

// What `gifts.importLink` read off a shop's product page.
export type ImportedFields = {
  title?: string
  description?: string
  // The canonical product URL, falling back to the pasted one.
  url: string
  // A remote image; the client uploads it through `POST /api/images` before
  // adding the present.
  imageUrl?: string
  // Fields the page had nothing for, each shown as a field-specific review
  // hint.
  missing: ('title' | 'description' | 'image')[]
}

// `gifts.importLink` resolves to this; it never throws for shop-side failures.
export type LinkImportOutcome =
  | { outcome: 'success'; fields: ImportedFields }
  // blockedShop is set when the URL matched the blocked shop list.
  | { outcome: 'unreadable'; blockedShop?: string }
  | { outcome: 'infra-failure' }

// Which Stream channel backs which chat thread (docs/spec.md §1.8, backend ADR
// 0001). `8b` is the event's one `event` thread; `8a` is a recipient's
// `secret` thread, which that recipient is never a member of.
export type ChatThreadDoc = {
  _id: string
  eventId: string
  kind: 'event' | 'secret'
  // secret only: the EventParticipant.id the thread is about.
  recipientParticipantId?: string
  streamChannelType: 'event_thread' | 'secret_thread'
  // Random, never derived from the event or the recipient.
  streamChannelId: string
  // Set once the thread is replaced; a retired thread is never published.
  retiredAt?: Date
}

// `4d`'s people search (`users.search`). Never carries an email.
export type UserSearchArgs = { query: string }
export type UserSearchResult = {
  userId: string
  name: string
  avatar?: string
  photo?: string
}

// The searchable words of a name, or of a search query: lower case,
// diacritics stripped (`ł` too, which has no decomposition), split on
// whitespace and hyphens. The server stores a user's as `nameTokens`.
export function nameTokens(text: string): string[] {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/ł/g, 'l')
    .split(/[\s-]+/)
    .filter(Boolean)
}

// A query shorter than this many folded characters searches nothing.
const USER_SEARCH_MIN_CHARS = 3

export const isSearchableQuery = (query: string) =>
  nameTokens(query).join('').length >= USER_SEARCH_MIN_CHARS

// What `stream.token` resolves to: the app's public API key and a user token
// for the caller, valid for an hour.
export type StreamToken = { apiKey: string; token: string }
