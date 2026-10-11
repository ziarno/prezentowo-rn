/// <reference types="jest" />
import type { EventDoc, GiftDoc } from '@prezentowo/types'

import {
  canEditGift,
  canRemoveGift,
  claimAction,
  claimCountForRemoval,
  isHiddenFrom,
  personPresents,
  presentCounts,
} from '../presentLists'

// Ola (real) created the event with Bartek (real) and Dziadek (placeholder).
const event: EventDoc = {
  _id: 'e1',
  title: 'Christmas',
  date: '2026-12-24',
  ownerId: 'ola',
  createdAt: new Date('2026-09-01'),
  participants: [
    { id: 'pOla', kind: 'real', userId: 'ola' },
    { id: 'pBartek', kind: 'real', userId: 'bartek' },
    { id: 'pDziadek', kind: 'placeholder', name: 'Dziadek', color: '#c7973d' },
  ],
  type: 'many-to-many',
}

let seq = 0
const gift = (
  forParticipantId: string,
  createdBy: string,
  extra: Partial<GiftDoc> = {},
): GiftDoc => ({
  _id: `g${++seq}`,
  eventId: 'e1',
  forParticipantId,
  title: `Gift ${seq}`,
  claimedBy: [],
  createdBy,
  createdAt: new Date('2026-09-02'),
  ...extra,
})

describe('personPresents', function () {
  it("splits someone else's list into their own wishes and suggestions", function () {
    const wish = gift('pBartek', 'bartek')
    const suggestion = gift('pBartek', 'ola')
    const forSomeoneElse = gift('pDziadek', 'ola')

    const list = personPresents(
      event,
      'pBartek',
      [wish, suggestion, forSomeoneElse],
      'ola',
    )

    expect(list).toEqual({
      kind: 'theirs',
      ownWishes: [wish],
      suggested: [suggestion],
    })
  })

  it("shows the viewer's own list as only what they added, never a suggestion", function () {
    const wish = gift('pBartek', 'bartek')
    // The publication never sends these; a stale local copy must not leak one.
    const suggestion = gift('pBartek', 'ola')

    const list = personPresents(event, 'pBartek', [wish, suggestion], 'bartek')

    expect(list).toEqual({ kind: 'mine', gifts: [wish] })
  })

  it("counts everything on a placeholder's list as suggested", function () {
    const suggestion = gift('pDziadek', 'ola')

    const list = personPresents(event, 'pDziadek', [suggestion], 'bartek')

    expect(list).toEqual({
      kind: 'theirs',
      ownWishes: [],
      suggested: [suggestion],
    })
  })
})

describe('personPresents, a departed recipient', function () {
  // Ola deleted her account: her place is a departed placeholder.
  const departedEvent: EventDoc = {
    ...event,
    participants: [
      {
        id: 'pOla',
        kind: 'placeholder',
        name: 'Ola',
        color: '#9a3a25',
        departedUserId: 'ola',
      },
      { id: 'pBartek', kind: 'real', userId: 'bartek' },
      {
        id: 'pDziadek',
        kind: 'placeholder',
        name: 'Dziadek',
        color: '#c7973d',
      },
    ],
    ownerId: 'bartek',
  }

  it('keeps their own wishes apart from the suggestions', function () {
    const wish = gift('pOla', 'ola')
    const suggestion = gift('pOla', 'bartek')

    const list = personPresents(
      departedEvent,
      'pOla',
      [wish, suggestion],
      'bartek',
    )

    expect(list).toEqual({
      kind: 'theirs',
      ownWishes: [wish],
      suggested: [suggestion],
    })
  })

  it('is no one’s own list, whoever looks', function () {
    const wish = gift('pOla', 'ola')

    expect(
      personPresents(departedEvent, 'pOla', [wish], undefined),
    ).toMatchObject({ kind: 'theirs', ownWishes: [wish] })
  })

  it('still counts a by-name placeholder’s list as all suggested', function () {
    const suggestion = gift('pDziadek', 'bartek')

    expect(
      personPresents(departedEvent, 'pDziadek', [suggestion], 'bartek'),
    ).toEqual({ kind: 'theirs', ownWishes: [], suggested: [suggestion] })
  })
})

describe('claimAction', function () {
  it('offers to buy a present nobody is buying yet', function () {
    expect(claimAction(event, gift('pBartek', 'ola'), 'ola')).toBe('claim')
  })

  it('offers to buy along when someone else already is', function () {
    const claimed = gift('pBartek', 'ola', { claimedBy: ['dziadekFan'] })

    expect(claimAction(event, claimed, 'ola')).toBe('claimToo')
  })

  it('offers to stop buying a present the viewer is buying', function () {
    const claimed = gift('pBartek', 'ola', { claimedBy: ['ola', 'x'] })

    expect(claimAction(event, claimed, 'ola')).toBe('unclaim')
  })

  it('offers nothing to the recipient, whose copy has no claim state', function () {
    const { claimedBy: _, ...stripped } = gift('pBartek', 'bartek')

    expect(claimAction(event, stripped as GiftDoc, 'bartek')).toBeNull()
  })
})

describe('presentCounts', function () {
  it('counts the presents the viewer can see for each person', function () {
    const gifts = [
      gift('pBartek', 'bartek'),
      gift('pBartek', 'ola'),
      gift('pDziadek', 'ola'),
    ]

    expect(presentCounts(event, gifts, 'ola')).toEqual({
      pOla: 0,
      pBartek: 2,
      pDziadek: 1,
    })
  })

  it("never counts a suggestion toward the viewer's own list", function () {
    const gifts = [gift('pBartek', 'bartek'), gift('pBartek', 'ola')]

    expect(presentCounts(event, gifts, 'bartek').pBartek).toBe(1)
  })
})

describe('isHiddenFrom', function () {
  it('hides a gift suggested for the viewer', function () {
    expect(isHiddenFrom(event, gift('pBartek', 'ola'), 'bartek')).toBe(true)
  })

  it("shows the viewer their own wishes and everyone else's gifts", function () {
    expect(isHiddenFrom(event, gift('pBartek', 'bartek'), 'bartek')).toBe(false)
    expect(isHiddenFrom(event, gift('pBartek', 'ola'), 'ola')).toBe(false)
  })
})

describe('canEditGift', function () {
  it('lets only the person who added a present edit it', function () {
    const suggestion = gift('pBartek', 'ola')
    expect(canEditGift(suggestion, 'ola')).toBe(true)
    expect(canEditGift(suggestion, 'bartek')).toBe(false)
  })
})

describe('canRemoveGift', function () {
  it('lets the person who added it or the event creator delete it', function () {
    const wish = gift('pBartek', 'bartek')
    expect(canRemoveGift(event, wish, 'bartek')).toBe(true)
    expect(canRemoveGift(event, wish, 'ola')).toBe(true)
    expect(canRemoveGift(event, gift('pOla', 'ola'), 'bartek')).toBe(false)
  })

  it('never offers the event creator a present hidden from them', function () {
    expect(canRemoveGift(event, gift('pOla', 'bartek'), 'ola')).toBe(false)
  })
})

describe('claimCountForRemoval', function () {
  it('counts the buyers the viewer can see', function () {
    expect(
      claimCountForRemoval(gift('pBartek', 'ola', { claimedBy: ['a', 'b'] })),
    ).toBe(2)
  })

  it('says nothing when nobody claimed it', function () {
    expect(claimCountForRemoval(gift('pBartek', 'ola'))).toBeNull()
  })

  it("says nothing when the viewer's copy carries no claim state", function () {
    const ownWish = gift('pBartek', 'bartek')
    delete (ownWish as Partial<GiftDoc>).claimedBy
    expect(claimCountForRemoval(ownWish)).toBeNull()
  })
})
