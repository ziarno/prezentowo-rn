import type {
  AddGiftArgs,
  EventDoc,
  GiftDoc,
  UpdateGiftArgs,
} from '@prezentowo/types'

import { type DraftImage, imageChange, savedImage } from './draftImage'
import { beneficiaryIdOf } from './events'

// The add-present wizard's steps: `5a` name, `5b` photo, `5c` description
// and link, `5d` summary. Link import on `5a` lands with its own slice.
export type GiftWizardStep = 'title' | 'photo' | 'details' | 'summary'

export type GiftWizardMode = 'add' | 'edit'

export type GiftDraft = {
  forParticipantId?: string
  title: string
  description: string
  url: string
  image?: DraftImage
  // Minted once per wizard, so resending the same add can't duplicate it.
  clientId: string
}

export type GiftStepError = 'titleRequired' | 'recipientRequired'

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
    case 'details':
      return null
    case 'summary':
      if (!draft.title.trim()) return 'titleRequired'
      return draft.forParticipantId ? null : 'recipientRequired'
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
  return {
    forParticipantId,
    title: '',
    description: '',
    url: '',
    clientId: newClientId(),
  }
}

export function draftFromGift(gift: GiftDoc): GiftDraft {
  return {
    forParticipantId: gift.forParticipantId,
    title: gift.title,
    description: gift.description ?? '',
    url: gift.url ?? '',
    image: gift.image,
    clientId: newClientId(),
  }
}

/** The `gifts.add` payload; an empty description or link is left out. */
export function toAddGiftArgs(eventId: string, draft: GiftDraft): AddGiftArgs {
  const description = draft.description.trim()
  const url = draft.url.trim()
  const image = savedImage(draft.image)
  return {
    eventId,
    forParticipantId: draft.forParticipantId!,
    title: draft.title.trim(),
    ...(description ? { description } : {}),
    ...(url ? { url } : {}),
    ...(image ? { image } : {}),
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
  return args
}
