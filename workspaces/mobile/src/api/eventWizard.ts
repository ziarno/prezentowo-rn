import type {
  CreateEventArgs,
  EventDoc,
  EventKind,
  UpdateEventArgs,
  UserSearchResult,
} from '@prezentowo/types'

import { garland } from '@/constants/colors'

import {
  type DraftImage,
  type LocalPhoto,
  imageChange,
  savedImage,
} from './draftImage'
import { parseEventDate } from './eventList'
import { beneficiaryIdOf } from './events'

// The create-event wizard's steps: `4a` name & date, `4b` kind, `4c`
// background, `4d` people, `4e` who the event is for (many-to-one only).
export type WizardStep =
  | 'details'
  | 'kind'
  | 'background'
  | 'people'
  | 'beneficiary'

export type WizardMode = 'create' | 'edit'

export type EventType = EventKind['type']

// Someone in the draft. `you` is the host; `member` is an existing
// participant in edit mode; `invited` is a user found by `4d`'s search, who
// becomes a reserved placeholder. `key` is the participant id in edit mode.
export type DraftPerson =
  | { key: string; kind: 'you' }
  | { key: string; kind: 'member' }
  | {
      key: string
      kind: 'invited'
      userId: string
      name: string
      avatar?: string
      color: string
    }
  | {
      key: string
      kind: 'placeholder'
      name: string
      color: string
      avatar?: string
      // Shown instead of `avatar`; uploaded when the wizard saves (§1.11).
      photo?: PlaceholderPhoto
    }

// A placeholder's photo, still on the device or already uploaded (kept in
// the draft so a retried save doesn't upload it again).
export type PlaceholderPhoto = LocalPhoto | { kind: 'upload'; id: string }

export type EventDraft = {
  title: string
  date: string
  type?: EventType
  beneficiaryKey?: string
  // Empty means none was picked; it renders the §1.1 fallback.
  background?: DraftImage
  people: DraftPerson[]
}

export type StepError =
  | 'nameRequired'
  | 'dateRequired'
  | 'kindRequired'
  | 'beneficiaryRequired'

const CREATE_STEPS: WizardStep[] = [
  'details',
  'kind',
  'background',
  'people',
  'beneficiary',
]

// People are edited on `6a` itself (remove) or by invite (add), and
// `UpdateEventArgs` has no participants, so edit mode never opens that step.
const EDIT_STEPS: WizardStep[] = [
  'details',
  'kind',
  'background',
  'beneficiary',
]

const PLACEHOLDER_COLORS = [garland.berry, garland.amber, garland.green]

export function parseStep(raw: unknown, mode: WizardMode): WizardStep {
  const steps = mode === 'create' ? CREATE_STEPS : EDIT_STEPS
  return steps.find(step => step === raw) ?? 'details'
}

/**
 * The steps the wizard walks. Creating has every step, whichever it starts
 * at; editing has just the starting one, plus `4e` after the kind when one
 * person gets presents.
 */
export function wizardSteps(
  mode: WizardMode,
  start: WizardStep,
  type: EventType | undefined,
): WizardStep[] {
  const applies = (step: WizardStep) =>
    step !== 'beneficiary' || type === 'many-to-one'
  if (mode === 'edit') {
    return start === 'kind'
      ? (['kind', 'beneficiary'] as const).filter(applies)
      : [start]
  }
  return CREATE_STEPS.filter(applies)
}

// Why `step` can't be left yet, or null when it can.
export function stepError(
  step: WizardStep,
  draft: EventDraft,
): StepError | null {
  switch (step) {
    case 'details': {
      if (!draft.title.trim()) return 'nameRequired'
      // Only the picker writes the date, so one that doesn't parse was
      // never picked.
      return parseEventDate(draft.date) ? null : 'dateRequired'
    }
    case 'kind':
      return draft.type ? null : 'kindRequired'
    case 'background':
    case 'people':
      return null
    case 'beneficiary':
      return draft.people.some(p => p.key === draft.beneficiaryKey)
        ? null
        : 'beneficiaryRequired'
  }
}

// The first of `steps` that isn't complete, e.g. one skipped by starting
// later, so submitting sends the user back to it.
export function firstInvalidStep(
  steps: WizardStep[],
  draft: EventDraft,
): WizardStep | null {
  return steps.find(step => stepError(step, draft)) ?? null
}

export function emptyDraft(): EventDraft {
  return { title: '', date: '', people: [{ key: 'you', kind: 'you' }] }
}

export function draftFromEvent(event: EventDoc, userId: string): EventDraft {
  return {
    title: event.title,
    date: event.date,
    type: event.type,
    beneficiaryKey: beneficiaryIdOf(event),
    background: event.background,
    people: event.participants.map(p =>
      p.kind === 'real' && p.userId === userId
        ? { key: p.id, kind: 'you' }
        : { key: p.id, kind: 'member' },
    ),
  }
}

let placeholderSeq = 0

// The color the next placeholder or invitee gets, rotating through the
// palette.
const nextColor = (draft: EventDraft) => {
  const colored = draft.people.filter(
    p => p.kind === 'placeholder' || p.kind === 'invited',
  )
  return PLACEHOLDER_COLORS[colored.length % PLACEHOLDER_COLORS.length]!
}

export function addPlaceholder(draft: EventDraft, name: string): EventDraft {
  const trimmed = name.trim()
  if (!trimmed) return draft
  const color = nextColor(draft)
  placeholderSeq += 1
  return {
    ...draft,
    people: [
      ...draft.people,
      {
        key: `placeholder-${placeholderSeq}`,
        kind: 'placeholder',
        name: trimmed,
        color,
      },
    ],
  }
}

// Whether a user found by search is already in the draft.
export const hasUser = (draft: EventDraft, userId: string) =>
  draft.people.some(p => p.kind === 'invited' && p.userId === userId)

// Adds a user found by search, once. They're invited, not added: they join
// only by accepting.
export function addInvitee(
  draft: EventDraft,
  user: UserSearchResult,
): EventDraft {
  if (hasUser(draft, user.userId)) return draft
  return {
    ...draft,
    people: [
      ...draft.people,
      {
        key: `invited-${user.userId}`,
        kind: 'invited',
        userId: user.userId,
        name: user.name,
        ...(user.avatar ? { avatar: user.avatar } : {}),
        color: nextColor(draft),
      },
    ],
  }
}

type Placeholder = Extract<DraftPerson, { kind: 'placeholder' }>

const updatePlaceholder = (
  draft: EventDraft,
  key: string,
  update: (placeholder: Placeholder) => Placeholder,
): EventDraft => ({
  ...draft,
  people: draft.people.map(p =>
    p.key === key && p.kind === 'placeholder' ? update(p) : p,
  ),
})

// A stock avatar replaces the photo.
export function setPlaceholderAvatar(
  draft: EventDraft,
  key: string,
  avatar: string,
): EventDraft {
  return updatePlaceholder(draft, key, ({ photo: _, ...p }) => ({
    ...p,
    avatar,
  }))
}

// `uri` is a photo taken or picked on the device.
export function setPlaceholderPhoto(
  draft: EventDraft,
  key: string,
  uri: string,
): EventDraft {
  return updatePlaceholder(draft, key, p => ({
    ...p,
    photo: { kind: 'local', uri },
  }))
}

export function removePlaceholderPhoto(
  draft: EventDraft,
  key: string,
): EventDraft {
  return updatePlaceholder(draft, key, ({ photo: _, ...p }) => p)
}

/**
 * The draft with every placeholder photo still on the device uploaded with
 * `upload`, one after another.
 */
export async function uploadPlaceholderPhotos(
  draft: EventDraft,
  upload: (localUri: string) => Promise<{ kind: 'upload'; id: string }>,
): Promise<EventDraft> {
  const people: DraftPerson[] = []
  for (const p of draft.people) {
    people.push(
      p.kind === 'placeholder' && p.photo?.kind === 'local'
        ? { ...p, photo: await upload(p.photo.uri) }
        : p,
    )
  }
  return { ...draft, people }
}

export function removePerson(draft: EventDraft, key: string): EventDraft {
  const person = draft.people.find(p => p.key === key)
  if (!person || person.kind === 'you') return draft
  return {
    ...draft,
    people: draft.people.filter(p => p.key !== key),
    beneficiaryKey:
      draft.beneficiaryKey === key ? undefined : draft.beneficiaryKey,
  }
}

/**
 * The `events.create` payload. Every person is sent, the host as a `real`
 * entry, so `beneficiaryIndex` can point at anyone, the host included.
 */
export function toCreateEventArgs(
  draft: EventDraft,
  userId: string,
): CreateEventArgs {
  const participants = draft.people.flatMap<CreateEventArgs['participants'][0]>(
    p => {
      if (p.kind === 'you') return [{ kind: 'real', userId }]
      if (p.kind === 'invited') {
        return [{ kind: 'invited', userId: p.userId, color: p.color }]
      }
      if (p.kind === 'placeholder') {
        if (p.photo?.kind === 'local') {
          throw new Error('A photo must be uploaded before saving')
        }
        return [
          {
            kind: 'placeholder',
            name: p.name,
            color: p.color,
            ...(p.avatar ? { avatar: p.avatar } : {}),
            ...(p.photo ? { photo: p.photo.id } : {}),
          },
        ]
      }
      return []
    },
  )
  const background = savedImage(draft.background)
  const base = {
    title: draft.title.trim(),
    date: draft.date.trim(),
    ...(background ? { background } : {}),
    participants,
  }
  if (draft.type === 'many-to-one') {
    return {
      ...base,
      type: 'many-to-one',
      beneficiaryIndex: draft.people.findIndex(
        p => p.key === draft.beneficiaryKey,
      ),
    }
  }
  return { ...base, type: 'many-to-many' }
}

/**
 * The `events.update` payload: only the fields the draft changed, with null
 * for a removed background.
 */
export function toUpdateEventArgs(
  event: EventDoc,
  draft: EventDraft,
): UpdateEventArgs {
  const args: UpdateEventArgs = { eventId: event._id }
  const title = draft.title.trim()
  const date = draft.date.trim()
  if (title !== event.title) args.title = title
  if (date !== event.date) args.date = date
  const background = imageChange(event.background, savedImage(draft.background))
  if (background !== undefined) args.background = background

  // The kind is sent whole whenever its type or beneficiary changed.
  if (
    draft.type &&
    (draft.type !== event.type ||
      (draft.type === 'many-to-one' &&
        draft.beneficiaryKey !== beneficiaryIdOf(event)))
  ) {
    if (draft.type === 'many-to-many') {
      args.kind = { type: 'many-to-many' }
    } else if (draft.beneficiaryKey) {
      args.kind = {
        type: 'many-to-one',
        beneficiaryParticipantId: draft.beneficiaryKey,
      }
    }
  }
  return args
}
