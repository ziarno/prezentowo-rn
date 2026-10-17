export type RegisterNewUserArgs = {
  email: string
  password: string
  name: string
}

// A user's picture is `profile.photo` when set, else the stock
// `profile.avatar` (docs/spec.md §1.10). There is no email: it is the
// magic-link identity and can't be changed.
export type UpdateUserArgs = {
  name?: string
  // A stock avatar key, e.g. "f3".
  avatar?: string
  // An upload id. null clears it; undefined leaves it unchanged.
  photo?: string | null
}

// The date of birth, asked at first login and kept as a full `YYYY-MM-DD`
// string on the user's own document (docs/spec.md §1.15). A document with no
// `birthDate` hasn't answered yet. Whether someone is 13 or 16 is never
// stored: it is computed against a day, every time, by the helpers below.

// "Today" is the UTC calendar day, on the server and in the app alike: one
// time zone, so both sides agree on the day someone turns 16. In Poland a
// birthday takes effect at 01:00 or 02:00 local time, never earlier.
export function todayUtc(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10)
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

const isLeapYear = (year: number) =>
  (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0

const daysInMonth = (year: number, month: number) =>
  month === 2
    ? isLeapYear(year)
      ? 29
      : 28
    : [4, 6, 9, 11].includes(month)
      ? 30
      : 31

function parseIsoDate(value: unknown) {
  const match = typeof value === 'string' ? ISO_DATE.exec(value) : null
  if (!match) return undefined
  // No array destructuring: the app's Node tests would need a Babel helper
  // that `@prezentowo/types` doesn't depend on.
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (month < 1 || month > 12) return undefined
  if (day < 1 || day > daysInMonth(year, month)) return undefined
  return { year, month, day }
}

// A real calendar day written `YYYY-MM-DD`, nothing else.
export function isIsoDate(value: unknown): value is string {
  return parseIsoDate(value) !== undefined
}

const pad = (n: number, width: number) => String(n).padStart(width, '0')

// Whole years from `birthDate` to `today`, both `YYYY-MM-DD`. Born on Feb 29,
// the birthday falls on Mar 1 in a year with no Feb 29: the later of the two
// days, so the person is never taken for older than they are.
export function ageOn(birthDate: string, today: string): number {
  const born = parseIsoDate(birthDate)
  const now = parseIsoDate(today)
  if (!born || !now) throw new Error('ageOn needs two YYYY-MM-DD dates')
  const feb29 = born.month === 2 && born.day === 29 && !isLeapYear(now.year)
  const birthdayMonth = feb29 ? 3 : born.month
  const birthdayDay = feb29 ? 1 : born.day
  const passed =
    now.month > birthdayMonth ||
    (now.month === birthdayMonth && now.day >= birthdayDay)
  return now.year - born.year - (passed ? 0 : 1)
}

// The latest birth date of someone who is `age` or older on `today`: `today`
// minus `age` years. `birthDate <= latestBirthDateAtAge(16, today)` is the
// same test as `ageOn(birthDate, today) >= 16`, as a string comparison a
// database index can answer. A Feb 29 `today` in a year `age` years back
// with no Feb 29 gives Feb 28.
export function latestBirthDateAtAge(age: number, today: string): string {
  const now = parseIsoDate(today)
  if (!now) throw new Error('latestBirthDateAtAge needs a YYYY-MM-DD date')
  const year = now.year - age
  const day = Math.min(now.day, daysInMonth(year, now.month))
  return `${pad(year, 4)}-${pad(now.month, 2)}-${pad(day, 2)}`
}

// The least age that can have an account (§1.15, §3.7), the age push and
// being found by name start at, and the oldest a birth date may make
// someone: past that it is taken for a typo.
export const MIN_AGE = 13
export const PUSH_AGE = 16
export const MAX_AGE = 120

// The earliest birth date `birthDateProblem` accepts on `today`.
export const earliestBirthDate = (today: string) =>
  latestBirthDateAtAge(MAX_AGE, today)

export type BirthDateProblem = 'malformed' | 'future' | 'tooOld'

// What is wrong with a birth date, if anything: not a real `YYYY-MM-DD` day,
// after `today`, or more than 120 years back. Nothing else is checked: there
// is no confirmation and no ID.
export function birthDateProblem(
  birthDate: unknown,
  today: string,
): BirthDateProblem | null {
  if (!isIsoDate(birthDate)) return 'malformed'
  if (birthDate > today) return 'future'
  if (birthDate < earliestBirthDate(today)) return 'tooOld'
  return null
}

// Whether a birth date makes someone under 13 on `today`. No date is false:
// there is nothing to judge.
export function isUnder13(birthDate: string | undefined, today: string) {
  return !!birthDate && ageOn(birthDate, today) < MIN_AGE
}

// Whether a user document is 16 or over on `today`. No birth date (not
// answered yet) is false, so a feature that is only for 16+ (push, being
// found by search) stays off until the person has answered. Callers pass
// the current `todayUtc()`, so it turns on by itself on the birthday.
export function isSixteenPlus(
  user: { birthDate?: string } | null | undefined,
  today: string,
) {
  return !!user?.birthDate && ageOn(user.birthDate, today) >= PUSH_AGE
}

// `users.setBirthDate`: the answer to the first-login question. Set once.
export type SetBirthDateArgs = { birthDate: string }

// What `users.setBirthDate` did: `deleted` is true only when the account went
// (an under-13 date to a question still open). An account that already has a
// date is left alone and answers `deleted: false`.
export type SetBirthDateResult = { deleted: boolean }

// `users.deleteAccount` (docs/spec.md §1.12): the account's own email,
// retyped as a deliberate-action check, matched case-insensitively.
export type DeleteAccountArgs = { email: string }

// What `users.stats` resolves to (docs/spec.md §1.14). Counted fresh from
// today's data on every call, never stored on the user.
export type UserStats = {
  // Events the caller is a real participant of, past ones included.
  events: number
  // Gifts the caller added for themselves in those events.
  wished: number
  // Gifts in those events whose `claimedBy` holds the caller.
  claimed: number
}

// The app's languages, as the Language row sets them.
export type AppLanguage = 'en' | 'pl'

// What deleting an account does, in the order shown (docs/spec.md §10.4).
// One source for the app's confirm and the web confirm page (§3.6).
export const ACCOUNT_DELETION_CONSEQUENCES: Record<
  AppLanguage,
  readonly string[]
> = {
  en: [
    'Your name stays on other people’s lists, so their plans still make sense.',
    'Your chat messages stay, shown as “Deleted user”.',
    'Gifts you added for others stay.',
    'Gifts you claimed are released.',
    'Events you created pass to their earliest remaining member, or are deleted if no one else is in them.',
    'Backups rotate out within 30 days.',
  ],
  pl: [
    'Twoje imię zostaje na listach innych osób, żeby ich plany nadal miały sens.',
    'Twoje wiadomości na czacie zostają, podpisane jako „Deleted user”.',
    'Prezenty dodane przez Ciebie dla innych zostają.',
    'Prezenty, które kupujesz, znów będą wolne do kupienia przez innych.',
    'Wydarzenia utworzone przez Ciebie przechodzą na osobę, która dołączyła do nich najwcześniej, albo zostają usunięte, jeśli nikogo innego w nich nie ma.',
    'Kopie zapasowe znikają w ciągu 30 dni.',
  ],
}

// What can push (docs/spec.md §1.13): every notification kind except
// `invite-deferred` and `event-handed-over`, plus chat messages.
export const PUSH_KINDS = [
  'invited',
  'participant-joined',
  'suggestion-claimed',
  'claimed-gift-removed',
  'chat',
] as const
export type PushKind = (typeof PUSH_KINDS)[number]

// On the user document, published to that user only. A missing entry counts
// as on.
export type PushPreferences = Partial<Record<PushKind, boolean>>

export type SetPushPreferenceArgs = { kind: PushKind; enabled: boolean }

// `push.register`: one device's two addresses, the Expo token for inbox
// pushes and the native APNs/FCM token the server registers with Stream.
export type RegisterPushArgs = {
  expoToken: string
  deviceToken: string
  platform: 'ios' | 'android'
  // The app's language on this device; inbox push text is written in it.
  locale: AppLanguage
  // iOS only: which APNs environment the build's tokens belong to, so the
  // server picks the matching Stream provider. Missing means production.
  apnsEnvironment?: ApnsEnvironment
}

export type ApnsEnvironment = 'development' | 'production'

// `push.unregister` takes no login: the token is the proof of the device.
export type UnregisterPushArgs = { expoToken: string }

// The `data` of an inbox push: the notification it mirrors, and what the
// inbox's routing needs to open it.
export type InboxPushData = {
  notificationId: string
  kind: Exclude<PushKind, 'chat'>
  eventId: string
  giftId?: string
  recipientParticipantId?: string
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
      // Set = a departed placeholder: what a deleted account's place in the
      // event became, holding the account's former userId (docs/spec.md
      // §1.12). Published. Nobody can claim it.
      departedUserId?: string
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

// How a present's picture is staged on its `1e` screen (docs/spec.md §1.1).
// Append-only, like the stock art: an id is never reused or renamed.
export const PRESENT_THEME_IDS = [
  'polaroid',
  'rays',
  'wrapped',
  'confetti',
  'snowfall',
  'torn',
  'popArt',
  'sticker',
] as const

export type PresentThemeId = (typeof PRESENT_THEME_IDS)[number]

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

// `6a`'s add: placeholders by name and users found by search, appended
// like `events.create`'s. Nobody is made a real participant this way.
export type AddParticipantsArgs = {
  eventId: string
  participants: Exclude<EventParticipantInput, { kind: 'real' }>[]
}

// The creator's edit of a placeholder's name and picture (docs/spec.md
// §1.11). Like `UpdateUserArgs`: picking a stock avatar sends
// `{ avatar, photo: null }`.
export type UpdateParticipantArgs = {
  eventId: string
  participantId: string
  name?: string
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
  // Unset (or an id this build doesn't know) shows a stable pick.
  theme?: PresentThemeId
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
  theme?: PresentThemeId
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
  theme?: PresentThemeId
}

// One already-occurred thing in an event's history, shown on Home and the
// event feed. Every field is a snapshot taken at write time.
export type ActivityDoc = {
  _id: string
  eventId: string
  kind: 'gift-added' | 'gift-claimed' | 'gift-unclaimed' | 'participant-joined'
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
    // You're now the creator of an event whose creator deleted their
    // account (docs/spec.md §1.12). Never pushes.
    | 'event-handed-over'
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
  // Server-only: set once the Stream freeze of a retired thread succeeds, so
  // the freeze retry survives a restart.
  frozenAt?: Date
}

// `4d`'s people search (`users.search`). Never carries an email.
export type UserSearchArgs = { query: string }
export type UserSearchResult = {
  userId: string
  name: string
  avatar?: string
  photo?: string
}

// An event title, present title or person name as stored: its first
// character in upper case, the rest as typed ("iPhone" becomes "IPhone").
// Every write of one goes through here.
export function upperFirst(text: string): string {
  const first = text.codePointAt(0)
  if (first === undefined) return text
  const head = String.fromCodePoint(first)
  return head.toLocaleUpperCase() + text.slice(head.length)
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
