/// <reference types="jest" />
import type { EventDoc, GiftDoc } from '@prezentowo/types'

import type { GiftDraft } from '../giftWizard'
import {
  draftFromGift,
  draftFromImport,
  emptyGiftDraft,
  giftStepError,
  giftWizardSteps,
  recipientOptions,
  startingRecipient,
  toAddGiftArgs,
  toUpdateGiftArgs,
} from '../giftWizard'

const ME = 'user-me'

const event = (overrides: Partial<EventDoc> = {}): EventDoc =>
  ({
    _id: 'e1',
    title: 'Wigilia',
    date: '2026-12-24',
    ownerId: ME,
    createdAt: new Date(),
    participants: [
      { id: 'p-me', kind: 'real', userId: ME },
      { id: 'p-anna', kind: 'real', userId: 'user-anna' },
      { id: 'p-babcia', kind: 'placeholder', name: 'Babcia', color: '#c33' },
    ],
    type: 'many-to-many',
    ...overrides,
  }) as EventDoc

const birthday = () =>
  event({
    type: 'many-to-one',
    beneficiaryParticipantId: 'p-anna',
  } as Partial<EventDoc>)

const draft = (overrides: Partial<GiftDraft> = {}): GiftDraft => ({
  forParticipantId: 'p-anna',
  title: 'Scarf',
  description: '',
  url: '',
  clientId: 'client-1',
  ...overrides,
})

describe('giftWizardSteps', () => {
  it('walks title, photo, details and the summary when adding', () => {
    expect(giftWizardSteps('add')).toEqual([
      'title',
      'photo',
      'details',
      'summary',
    ])
  })

  it('opens straight on the summary when editing', () => {
    expect(giftWizardSteps('edit')).toEqual(['summary'])
  })
})

describe('giftStepError', () => {
  it('needs a name before leaving 5a', () => {
    expect(giftStepError('title', draft({ title: '  ' }))).toBe('titleRequired')
    expect(giftStepError('title', draft())).toBeNull()
  })

  it('lets the photo and details steps be skipped', () => {
    expect(giftStepError('photo', draft())).toBeNull()
    expect(giftStepError('details', draft())).toBeNull()
  })

  it('needs a name and a recipient on the summary', () => {
    expect(giftStepError('summary', draft({ title: '' }))).toBe('titleRequired')
    expect(
      giftStepError('summary', draft({ forParticipantId: undefined })),
    ).toBe('recipientRequired')
    expect(giftStepError('summary', draft())).toBeNull()
  })
})

describe('recipientOptions', () => {
  it('offers everyone when everyone gets presents', () => {
    expect(recipientOptions(event())).toEqual(['p-me', 'p-anna', 'p-babcia'])
  })

  it('offers only the beneficiary when one person gets presents', () => {
    expect(recipientOptions(birthday())).toEqual(['p-anna'])
  })
})

describe('startingRecipient', () => {
  it('keeps the person whose list the wizard was opened from', () => {
    expect(startingRecipient(event(), 'p-babcia', ME)).toBe('p-babcia')
  })

  it('falls back to the viewer when opened from nowhere in particular', () => {
    expect(startingRecipient(event(), undefined, ME)).toBe('p-me')
  })

  it('ignores someone who is not in the event', () => {
    expect(startingRecipient(event(), 'p-gone', ME)).toBe('p-me')
  })

  it('always picks the beneficiary when one person gets presents', () => {
    expect(startingRecipient(birthday(), undefined, ME)).toBe('p-anna')
    expect(startingRecipient(birthday(), 'p-me', ME)).toBe('p-anna')
  })
})

const gift = (overrides: Partial<GiftDoc> = {}): GiftDoc => ({
  _id: 'g1',
  eventId: 'e1',
  forParticipantId: 'p-anna',
  title: 'Scarf',
  description: 'Green, wool',
  url: 'shop.pl/scarf',
  claimedBy: [],
  createdBy: ME,
  createdAt: new Date(),
  ...overrides,
})

describe('emptyGiftDraft', () => {
  it('starts with the recipient and a fresh client id each time', () => {
    const a = emptyGiftDraft('p-anna')
    const b = emptyGiftDraft('p-anna')
    expect(a).toMatchObject({
      forParticipantId: 'p-anna',
      title: '',
      description: '',
      url: '',
    })
    expect(a.clientId).toMatch(/^[A-Za-z0-9]{17}$/)
    expect(a.clientId).not.toBe(b.clientId)
  })
})

describe('draftFromImport', () => {
  it('fills the draft from the shop, keeping its recipient and client id', () => {
    expect(
      draftFromImport(draft({ title: '', url: 'x-kom.pl/p/1' }), {
        title: 'Kettle',
        description: 'Steel, 1.7 l',
        url: 'https://www.x-kom.pl/p/1-kettle.html',
        imageUrl: 'https://cdn.x-kom.pl/1.jpg',
        missing: [],
      }),
    ).toEqual({
      forParticipantId: 'p-anna',
      title: 'Kettle',
      description: 'Steel, 1.7 l',
      url: 'https://www.x-kom.pl/p/1-kettle.html',
      image: { kind: 'remote', uri: 'https://cdn.x-kom.pl/1.jpg' },
      clientId: 'client-1',
    })
  })

  it('keeps what the person already typed or picked', () => {
    const picked = { kind: 'illustration', id: 'p3' } as const
    expect(
      draftFromImport(
        draft({ title: 'Kettle for mum', description: 'Red', image: picked }),
        {
          title: 'Kettle',
          description: 'Steel, 1.7 l',
          url: 'https://shop.test/kettle',
          imageUrl: 'https://shop.test/kettle.jpg',
          missing: [],
        },
      ),
    ).toMatchObject({
      title: 'Kettle for mum',
      description: 'Red',
      url: 'https://shop.test/kettle',
      image: picked,
    })
  })

  it('leaves a field the shop could not fill as it was', () => {
    expect(
      draftFromImport(draft({ title: '' }), {
        url: 'https://shop.test/kettle',
        missing: ['title', 'description', 'image'],
      }),
    ).toEqual(draft({ title: '', url: 'https://shop.test/kettle' }))
  })
})

describe('toAddGiftArgs', () => {
  it('sends the trimmed fields with the draft client id', () => {
    expect(
      toAddGiftArgs(
        'e1',
        draft({
          title: '  Scarf ',
          description: ' Green ',
          url: ' shop.pl/scarf ',
        }),
      ),
    ).toEqual({
      eventId: 'e1',
      forParticipantId: 'p-anna',
      title: 'Scarf',
      description: 'Green',
      url: 'shop.pl/scarf',
      clientId: 'client-1',
    })
  })

  it('leaves out an empty description and link', () => {
    expect(toAddGiftArgs('e1', draft({ description: ' ', url: '' }))).toEqual({
      eventId: 'e1',
      forParticipantId: 'p-anna',
      title: 'Scarf',
      clientId: 'client-1',
    })
  })
})

describe('toAddGiftArgs with a photo', () => {
  it('keeps one still on the device, for the queue to upload', () => {
    const photo = { kind: 'local', uri: 'file:///bell.jpg' } as const
    expect(toAddGiftArgs('e1', draft({ image: photo })).image).toEqual(photo)
  })
})

describe('toUpdateGiftArgs', () => {
  it('sends nothing but the gift id when nothing changed', () => {
    const g = gift()
    expect(toUpdateGiftArgs(g, draftFromGift(g))).toEqual({ giftId: 'g1' })
  })

  it('sends only the fields that changed', () => {
    const g = gift()
    expect(
      toUpdateGiftArgs(g, {
        ...draftFromGift(g),
        title: 'Red scarf ',
        url: '',
      }),
    ).toEqual({ giftId: 'g1', title: 'Red scarf', url: '' })
  })

  it('treats a missing description as an empty one', () => {
    const g = gift({ description: undefined })
    expect(toUpdateGiftArgs(g, draftFromGift(g))).toEqual({ giftId: 'g1' })
    expect(
      toUpdateGiftArgs(g, { ...draftFromGift(g), description: 'Soft' }),
    ).toEqual({ giftId: 'g1', description: 'Soft' })
  })

  it('sends a replaced or removed photo, and nothing for the same one', () => {
    const photo = { kind: 'upload', id: 'u1' } as const
    const g = gift({ image: photo })

    expect(toUpdateGiftArgs(g, draftFromGift(g))).toEqual({ giftId: 'g1' })
    expect(
      toUpdateGiftArgs(g, {
        ...draftFromGift(g),
        image: { kind: 'upload', id: 'u2' },
      }),
    ).toEqual({ giftId: 'g1', image: { kind: 'upload', id: 'u2' } })
    expect(
      toUpdateGiftArgs(g, { ...draftFromGift(g), image: undefined }),
    ).toEqual({ giftId: 'g1', image: null })
  })
})
