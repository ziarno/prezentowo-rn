/// <reference types="jest" />
import type { EventDoc } from '@prezentowo/types'

import {
  type EventDraft,
  addPlaceholder,
  draftFromEvent,
  emptyDraft,
  firstInvalidStep,
  parseStep,
  removePerson,
  stepError,
  toCreateEventArgs,
  toUpdateEventArgs,
  wizardSteps,
} from '../eventWizard'

const ME = 'user-me'

const draft = (overrides: Partial<EventDraft> = {}): EventDraft => ({
  ...emptyDraft(),
  title: 'Urodziny',
  date: '2026-05-04',
  ...overrides,
})

const event = (overrides: Partial<EventDoc> = {}): EventDoc =>
  ({
    _id: 'e1',
    title: 'Wigilia',
    date: '2026-12-24',
    ownerId: ME,
    createdAt: new Date(),
    participants: [
      { id: 'p-me', kind: 'real', userId: ME },
      { id: 'p-babcia', kind: 'placeholder', name: 'Babcia', color: '#c33' },
    ],
    type: 'many-to-many',
    ...overrides,
  }) as EventDoc

describe('wizardSteps', () => {
  it('asks who the event is for only when one person gets presents', () => {
    expect(wizardSteps('create', 'details', 'many-to-many')).toEqual([
      'details',
      'kind',
      'background',
      'people',
    ])
    expect(wizardSteps('create', 'details', undefined)).toEqual([
      'details',
      'kind',
      'background',
      'people',
    ])
    expect(wizardSteps('create', 'details', 'many-to-one')).toEqual([
      'details',
      'kind',
      'background',
      'people',
      'beneficiary',
    ])
  })

  it('keeps every creation step, whatever step it starts at', () => {
    expect(wizardSteps('create', 'people', 'many-to-one')).toEqual([
      'details',
      'kind',
      'background',
      'people',
      'beneficiary',
    ])
  })

  it('edits one step, following the kind to its beneficiary', () => {
    expect(wizardSteps('edit', 'details', 'many-to-one')).toEqual(['details'])
    expect(wizardSteps('edit', 'kind', 'many-to-many')).toEqual(['kind'])
    expect(wizardSteps('edit', 'kind', 'many-to-one')).toEqual([
      'kind',
      'beneficiary',
    ])
    expect(wizardSteps('edit', 'beneficiary', 'many-to-one')).toEqual([
      'beneficiary',
    ])
  })
})

describe('parseStep', () => {
  it('falls back to the first step for anything unknown', () => {
    expect(parseStep(undefined, 'create')).toBe('details')
    expect(parseStep('nope', 'create')).toBe('details')
    expect(parseStep('kind', 'create')).toBe('kind')
  })

  it('never edits the people step, which has no update path', () => {
    expect(parseStep('people', 'edit')).toBe('details')
    expect(parseStep('beneficiary', 'edit')).toBe('beneficiary')
  })
})

describe('stepError', () => {
  it('needs a name and a calendar date', () => {
    expect(stepError('details', draft({ title: '  ' }))).toBe('nameRequired')
    expect(stepError('details', draft({ date: '' }))).toBe('dateRequired')
    expect(stepError('details', draft({ date: '4 May' }))).toBe('dateInvalid')
    expect(stepError('details', draft({ date: '2026-02-30' }))).toBe(
      'dateInvalid',
    )
    expect(stepError('details', draft())).toBeNull()
  })

  it('needs a kind', () => {
    expect(stepError('kind', draft())).toBe('kindRequired')
    expect(stepError('kind', draft({ type: 'many-to-many' }))).toBeNull()
  })

  it('needs a beneficiary who is still in the event', () => {
    const d = draft({ type: 'many-to-one' })
    expect(stepError('beneficiary', d)).toBe('beneficiaryRequired')
    expect(stepError('beneficiary', { ...d, beneficiaryKey: 'gone' })).toBe(
      'beneficiaryRequired',
    )
    expect(
      stepError('beneficiary', { ...d, beneficiaryKey: d.people[0]!.key }),
    ).toBeNull()
  })

  it('lets the people step through empty: others can join by link', () => {
    expect(stepError('people', draft())).toBeNull()
  })
})

describe('firstInvalidStep', () => {
  it('finds a step skipped by starting later', () => {
    const steps = wizardSteps('create', 'people', undefined)
    expect(firstInvalidStep(steps, draft())).toBe('kind')
    expect(firstInvalidStep(steps, emptyDraft())).toBe('details')
  })

  it('is null once every step is complete', () => {
    const d = draft({ type: 'many-to-one', beneficiaryKey: 'you' })
    expect(
      firstInvalidStep(wizardSteps('create', 'details', d.type), d),
    ).toBeNull()
  })
})

describe('people', () => {
  it('starts with the host alone', () => {
    expect(emptyDraft().people).toEqual([{ key: 'you', kind: 'you' }])
  })

  it('adds trimmed placeholders with rotating colors and ignores blanks', () => {
    let d = addPlaceholder(draft(), '  Babcia ')
    d = addPlaceholder(d, '   ')
    d = addPlaceholder(d, 'Dziadek')

    const [, babcia, dziadek] = d.people
    expect(d.people).toHaveLength(3)
    expect(babcia).toMatchObject({ kind: 'placeholder', name: 'Babcia' })
    expect(dziadek).toMatchObject({ kind: 'placeholder', name: 'Dziadek' })
    expect(babcia!.key).not.toBe(dziadek!.key)
    expect(babcia!.kind === 'placeholder' && babcia.color).not.toBe(
      dziadek!.kind === 'placeholder' && dziadek.color,
    )
  })

  it('clears the beneficiary when they are removed', () => {
    const d = addPlaceholder(draft({ type: 'many-to-one' }), 'Babcia')
    const babcia = d.people[1]!.key

    const removed = removePerson({ ...d, beneficiaryKey: babcia }, babcia)

    expect(removed.people).toHaveLength(1)
    expect(removed.beneficiaryKey).toBeUndefined()
  })

  it('never removes the host', () => {
    expect(removePerson(draft(), 'you').people).toHaveLength(1)
  })
})

describe('toCreateEventArgs', () => {
  it('sends the host first and a many-to-many kind without a beneficiary', () => {
    const d = addPlaceholder(draft({ type: 'many-to-many' }), 'Babcia')

    expect(toCreateEventArgs(d, ME)).toEqual({
      title: 'Urodziny',
      date: '2026-05-04',
      type: 'many-to-many',
      participants: [
        { kind: 'real', userId: ME },
        {
          kind: 'placeholder',
          name: 'Babcia',
          color: expect.any(String),
        },
      ],
    })
  })

  it('names the beneficiary by index, host included', () => {
    const d = addPlaceholder(draft({ type: 'many-to-one' }), 'Babcia')

    expect(
      toCreateEventArgs({ ...d, beneficiaryKey: d.people[1]!.key }, ME),
    ).toMatchObject({ type: 'many-to-one', beneficiaryIndex: 1 })
    expect(
      toCreateEventArgs({ ...d, beneficiaryKey: 'you' }, ME),
    ).toMatchObject({ type: 'many-to-one', beneficiaryIndex: 0 })
  })

  it('trims the name', () => {
    expect(
      toCreateEventArgs(
        draft({ title: ' Urodziny  ', type: 'many-to-many' }),
        ME,
      ).title,
    ).toBe('Urodziny')
  })
})

describe('edit mode', () => {
  it('drafts from the event, keyed by participant id', () => {
    const d = draftFromEvent(
      event({ type: 'many-to-one', beneficiaryParticipantId: 'p-babcia' }),
      ME,
    )

    expect(d).toMatchObject({
      title: 'Wigilia',
      date: '2026-12-24',
      type: 'many-to-one',
      beneficiaryKey: 'p-babcia',
    })
    expect(d.people.map(p => [p.key, p.kind])).toEqual([
      ['p-me', 'you'],
      ['p-babcia', 'member'],
    ])
  })

  it('sends only what changed', () => {
    const e = event()

    expect(
      toUpdateEventArgs(e, { ...draftFromEvent(e, ME), title: 'Wigilia 2026' }),
    ).toEqual({ eventId: 'e1', title: 'Wigilia 2026' })
    expect(toUpdateEventArgs(e, draftFromEvent(e, ME))).toEqual({
      eventId: 'e1',
    })
  })

  it('sends the kind with the beneficiary as a participant id', () => {
    const e = event()
    const d: EventDraft = {
      ...draftFromEvent(e, ME),
      type: 'many-to-one',
      beneficiaryKey: 'p-babcia',
    }

    expect(toUpdateEventArgs(e, d)).toEqual({
      eventId: 'e1',
      kind: { type: 'many-to-one', beneficiaryParticipantId: 'p-babcia' },
    })
  })

  it('sends a beneficiary change on its own', () => {
    const e = event({ type: 'many-to-one', beneficiaryParticipantId: 'p-me' })

    expect(
      toUpdateEventArgs(e, {
        ...draftFromEvent(e, ME),
        beneficiaryKey: 'p-babcia',
      }),
    ).toEqual({
      eventId: 'e1',
      kind: { type: 'many-to-one', beneficiaryParticipantId: 'p-babcia' },
    })
  })
})

describe('background', () => {
  const photo = { kind: 'upload', id: 'u1' } as const

  it('comes after the kind when creating, and can be edited on its own', () => {
    expect(wizardSteps('create', 'details', 'many-to-many')).toContain(
      'background',
    )
    expect(parseStep('background', 'edit')).toBe('background')
    expect(wizardSteps('edit', 'background', 'many-to-one')).toEqual([
      'background',
    ])
  })

  it('is optional', () => {
    expect(stepError('background', draft())).toBeNull()
  })

  it('is sent on create only when one was picked', () => {
    expect(toCreateEventArgs(draft(), ME)).not.toHaveProperty('background')
    expect(toCreateEventArgs(draft({ background: photo }), ME)).toMatchObject({
      background: photo,
    })
  })

  it('is edited from the saved one: replaced, removed, or left alone', () => {
    const e = event({ background: photo })
    const edited = draftFromEvent(e, ME)
    expect(edited.background).toEqual(photo)

    expect(toUpdateEventArgs(e, edited)).toEqual({ eventId: 'e1' })
    expect(
      toUpdateEventArgs(e, {
        ...edited,
        background: { kind: 'upload', id: 'u2' },
      }),
    ).toEqual({ eventId: 'e1', background: { kind: 'upload', id: 'u2' } })
    expect(toUpdateEventArgs(e, { ...edited, background: undefined })).toEqual({
      eventId: 'e1',
      background: null,
    })
  })
})
