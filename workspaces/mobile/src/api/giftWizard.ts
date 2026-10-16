import {
  type EventDoc,
  type GiftDoc,
  type ImportedFields,
  PRESENT_ILLUSTRATION_IDS,
  type PresentThemeId,
  type UpdateGiftArgs,
  upperFirst,
} from '@prezentowo/types'

import { type DraftImage, imageChange, savedImage } from './draftImage'
import { stablePick } from './eventList'
import { beneficiaryIdOf } from './events'
import type { QueuedAddGiftArgs } from './pendingWrites'
import { presentTheme } from './stockArt'

// The add-present wizard's steps: `5a` name (or a link to import), `5b`
// photo, `5c` description and link, `5d` summary.
export type GiftWizardStep = 'title' | 'photo' | 'details' | 'summary'

export type GiftWizardMode = 'add' | 'edit'

export type GiftDraft = {
  forParticipantId?: string
  title: string
  description: string
  url: string
  image?: DraftImage
  // Always set: the add starts on the same stable pick a present without a
  // theme shows, seeded by the `clientId`, so skipping it saves what was
  // previewed.
  theme: PresentThemeId
  // Minted once per wizard, so resending the same add can't duplicate it.
  clientId: string
}

export type GiftStepError =
  | 'titleRequired'
  | 'linkInvalid'
  | 'recipientRequired'

/**
 * Whether `text` reads as a web address: http(s), or no scheme at all
 * ("x-kom.pl/p/…", taken as https, as the link import and `1e` take it),
 * with a dotted host and no spaces.
 */
export function isWebLink(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed || /\s/.test(trimmed)) return false
  const withScheme = /^[a-z][a-z\d+.-]*:/i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`
  let url: URL
  try {
    url = new URL(withScheme)
  } catch {
    return false
  }
  const host = url.hostname
  return (
    (url.protocol === 'http:' || url.protocol === 'https:') &&
    host.includes('.') &&
    !host.startsWith('.') &&
    !host.endsWith('.')
  )
}

// An empty link is fine: it's optional.
const linkError = (draft: GiftDraft): GiftStepError | null =>
  draft.url.trim() && !isWebLink(draft.url) ? 'linkInvalid' : null

const ADD_STEPS: GiftWizardStep[] = ['title', 'photo', 'details', 'summary']

// `1e`'s ✎ Edit reopens the wizard on the summary, where every field is.
const EDIT_STEPS: GiftWizardStep[] = ['summary']

export function giftWizardSteps(mode: GiftWizardMode): GiftWizardStep[] {
  return mode === 'add' ? ADD_STEPS : EDIT_STEPS
}

// Why `step` can't be left yet, or null when it can.
export function giftStepError(
  step: GiftWizardStep,
  draft: GiftDraft,
): GiftStepError | null {
  switch (step) {
    case 'title':
      return draft.title.trim() ? null : 'titleRequired'
    case 'photo':
      return null
    case 'details':
      return linkError(draft)
    case 'summary':
      if (!draft.title.trim()) return 'titleRequired'
      return (
        linkError(draft) ??
        (draft.forParticipantId ? null : 'recipientRequired')
      )
  }
}

// Who a present may be for: anyone when everyone gets presents, only the
// beneficiary when one person does.
export function recipientOptions(event: EventDoc): string[] {
  const beneficiaryId = beneficiaryIdOf(event)
  return beneficiaryId ? [beneficiaryId] : event.participants.map(p => p.id)
}

/**
 * The recipient the wizard starts with: the person whose list it was opened
 * from when they can get presents, else the viewer themselves, else the
 * first person who can.
 */
export function startingRecipient(
  event: EventDoc,
  requested: string | undefined,
  viewerUserId: string | undefined,
): string | undefined {
  const options = recipientOptions(event)
  if (requested && options.includes(requested)) return requested
  const viewer = event.participants.find(
    p => p.kind === 'real' && p.userId === viewerUserId,
  )
  if (viewer && options.includes(viewer.id)) return viewer.id
  return options[0]
}

const ID_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

// An idempotency key, unique per creator; it guards replays, not secrets.
function newClientId(): string {
  let id = ''
  for (let i = 0; i < 17; i++)
    id += ID_ALPHABET[Math.floor(Math.random() * ID_ALPHABET.length)]
  return id
}

export function emptyGiftDraft(
  forParticipantId: string | undefined,
): GiftDraft {
  const clientId = newClientId()
  return {
    forParticipantId,
    title: '',
    description: '',
    url: '',
    theme: presentTheme(undefined, clientId),
    clientId,
  }
}

export function draftFromGift(gift: GiftDoc): GiftDraft {
  return {
    forParticipantId: gift.forParticipantId,
    title: gift.title,
    description: gift.description ?? '',
    url: gift.url ?? '',
    image: gift.image,
    theme: presentTheme(gift.theme, gift._id),
    clientId: newClientId(),
  }
}

/**
 * The draft after a link import on `5a`: the shop fills what the person left
 * empty, and the link becomes the shop's canonical one. Its photo stays on
 * the shop's server until the wizard saves.
 */
export function draftFromImport(
  draft: GiftDraft,
  fields: ImportedFields,
): GiftDraft {
  return {
    ...draft,
    title: draft.title.trim() ? draft.title : (fields.title ?? draft.title),
    description: draft.description.trim()
      ? draft.description
      : (fields.description ?? draft.description),
    url: fields.url,
    image:
      draft.image ??
      (fields.imageUrl ? { kind: 'remote', uri: fields.imageUrl } : undefined),
  }
}

/**
 * The draft as an add's summary shows it: with no photo or illustration
 * picked, one of our illustrations at random, so the summary shows the
 * picture that will be saved. Seeded by the draft's `clientId`, so it's the
 * same pick each time the wizard comes back to the summary.
 */
export function withStockImage(draft: GiftDraft): GiftDraft {
  return draft.image
    ? draft
    : {
        ...draft,
        image: {
          kind: 'illustration',
          id: stablePick(draft.clientId, PRESENT_ILLUSTRATION_IDS),
        },
      }
}

/**
 * The `gifts.add` payload; an empty description or link is left out. A
 * photo not yet uploaded stays as it is: the add uploads it before it's sent,
 * at once or when replayed from the offline queue.
 */
export function toAddGiftArgs(
  eventId: string,
  draft: GiftDraft,
): QueuedAddGiftArgs {
  const description = draft.description.trim()
  const url = draft.url.trim()
  const image = draft.image
  return {
    eventId,
    forParticipantId: draft.forParticipantId!,
    // As the server will store it, for while it waits in the queue.
    title: upperFirst(draft.title.trim()),
    ...(description ? { description } : {}),
    ...(url ? { url } : {}),
    ...(image ? { image } : {}),
    theme: draft.theme,
    clientId: draft.clientId,
  }
}

/**
 * The `gifts.update` payload: only the fields the draft changed, with null
 * for a removed photo. The recipient is write-once.
 */
export function toUpdateGiftArgs(
  gift: GiftDoc,
  draft: GiftDraft,
): UpdateGiftArgs {
  const args: UpdateGiftArgs = { giftId: gift._id }
  const title = draft.title.trim()
  const description = draft.description.trim()
  const url = draft.url.trim()
  if (title !== gift.title) args.title = title
  if (description !== (gift.description ?? '')) args.description = description
  if (url !== (gift.url ?? '')) args.url = url
  const image = imageChange(gift.image, savedImage(draft.image))
  if (image !== undefined) args.image = image
  // The fallback a theme-less present shows counts as unchanged.
  if (draft.theme !== presentTheme(gift.theme, gift._id))
    args.theme = draft.theme
  return args
}
