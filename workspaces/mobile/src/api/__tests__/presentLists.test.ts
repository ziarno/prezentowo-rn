/// <reference types="jest" />
import type { EventDoc, GiftDoc } from '@prezentowo/types'

import {
  claimAction,
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
