import type {
  CreateEventArgs,
  EventDoc,
  EventKind,
  UpdateEventArgs,
} from '@prezentowo/types'

import { garland } from '@/constants/colors'

import { type DraftImage, imageChange, savedImage } from './draftImage'
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
// participant in edit mode. `key` is the participant id in edit mode.
export type DraftPerson =
  | { key: string; kind: 'you' }
  | { key: string; kind: 'member' }
  | {
      key: string
      kind: 'placeholder'
      name: string
      color: string
      avatar?: string
    }

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
  | 'dateInvalid'
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

// A real calendar day as `YYYY-MM-DD`, the format the server takes.
export function isCalendarDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false
  const parsed = new Date(`${date}T00:00:00Z`)
  return !isNaN(parsed.getTime()) && parsed.toISOString().startsWith(date)
}

// Why `step` can't be left yet, or null when it can.
export function stepError(
  step: WizardStep,
  draft: EventDraft,
): StepError | null {
  switch (step) {
    case 'details': {
      if (!draft.title.trim()) return 'nameRequired'
      const date = draft.date.trim()
      if (!date) return 'dateRequired'
      return isCalendarDate(date) ? null : 'dateInvalid'
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

export function addPlaceholder(draft: EventDraft, name: string): EventDraft {
  const trimmed = name.trim()
  if (!trimmed) return draft
  const placeholders = draft.people.filter(p => p.kind === 'placeholder')
  const color =
    PLACEHOLDER_COLORS[placeholders.length % PLACEHOLDER_COLORS.length]!
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

export function setPlaceholderAvatar(
  draft: EventDraft,
  key: string,
  avatar: string,
): EventDraft {
  return {
    ...draft,
    people: draft.people.map(p =>
      p.key === key && p.kind === 'placeholder' ? { ...p, avatar } : p,
    ),
  }
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
      if (p.kind === 'placeholder') {
        return [
          {
            kind: 'placeholder',
            name: p.name,
            color: p.color,
            ...(p.avatar ? { avatar: p.avatar } : {}),
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
