/// <reference types="jest" />
import type { ActivityDoc, EventDoc, GiftDoc } from '@prezentowo/types'

import {
  activityLine,
  activityLines,
  buyerSummary,
  timeAgo,
} from '../activityFeed'

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
const item = (fields: Partial<ActivityDoc>): ActivityDoc => ({
  _id: `a${++seq}`,
  eventId: 'e1',
  kind: 'participant-joined',
  actorParticipantId: 'pBartek',
  createdAt: new Date('2026-10-01T10:00:00'),
  ...fields,
})

describe('activityLine', function () {
  it('reports someone joining', function () {
    expect(activityLine(event, item({}), 'ola')).toEqual({
      kind: 'joined',
      actorId: 'pBartek',
    })
  })

  it('reads a present added by its own recipient as added to their list', function () {
    const added = item({
      kind: 'gift-added',
      actorParticipantId: 'pBartek',
      recipientParticipantId: 'pBartek',
      giftId: 'g1',
      giftTitle: 'Wool scarf',
    })

    expect(activityLine(event, added, 'ola')).toEqual({
      kind: 'self-added',
      actorId: 'pBartek',
      giftId: 'g1',
      giftTitle: 'Wool scarf',
    })
  })

  it('reads a present added by someone else as a suggestion for the recipient', function () {
    const added = item({
      kind: 'gift-added',
      actorParticipantId: 'pOla',
      recipientParticipantId: 'pDziadek',
      giftId: 'g1',
      giftTitle: 'Slippers',
    })

    expect(activityLine(event, added, 'bartek')).toEqual({
      kind: 'suggested',
      actorId: 'pOla',
      recipientId: 'pDziadek',
      giftId: 'g1',
      giftTitle: 'Slippers',
    })
  })

  it('reports someone buying a present, and for whom', function () {
    const claimed = item({
      kind: 'gift-claimed',
      actorParticipantId: 'pOla',
      recipientParticipantId: 'pDziadek',
      giftId: 'g1',
      giftTitle: 'Slippers',
    })

    expect(activityLine(event, claimed, 'bartek')).toEqual({
      kind: 'claimed',
      actorId: 'pOla',
      recipientId: 'pDziadek',
      giftId: 'g1',
      giftTitle: 'Slippers',
    })
  })

  it('reports someone no longer buying a present', function () {
    const unclaimed = item({
      kind: 'gift-unclaimed',
      actorParticipantId: 'pOla',
      recipientParticipantId: 'pDziadek',
      giftId: 'g1',
      giftTitle: 'Slippers',
    })

    expect(activityLine(event, unclaimed, 'bartek')).toEqual({
      kind: 'unclaimed',
      actorId: 'pOla',
      recipientId: 'pDziadek',
      giftId: 'g1',
      giftTitle: 'Slippers',
    })
  })

  // The publication never sends these; a stale local copy must not leak one.
  it('hides a suggestion and any claim from the recipient', function () {
    const suggested = item({
      kind: 'gift-added',
      actorParticipantId: 'pOla',
      recipientParticipantId: 'pBartek',
      giftId: 'g1',
      giftTitle: 'Wool scarf',
    })
    const claimedOwnWish = item({
      kind: 'gift-claimed',
      actorParticipantId: 'pOla',
      recipientParticipantId: 'pBartek',
      giftId: 'g2',
      giftTitle: 'Board game',
    })

    expect(activityLine(event, suggested, 'bartek')).toBeNull()
    expect(activityLine(event, claimedOwnWish, 'bartek')).toBeNull()
  })

  it("shows the recipient their own list's additions", function () {
    const added = item({
      kind: 'gift-added',
      actorParticipantId: 'pBartek',
      recipientParticipantId: 'pBartek',
      giftId: 'g1',
      giftTitle: 'Wool scarf',
    })

    expect(activityLine(event, added, 'bartek')).not.toBeNull()
  })

  it('drops a present item that lost its present fields', function () {
    const broken = item({ kind: 'gift-claimed', actorParticipantId: 'pOla' })

    expect(activityLine(event, broken, 'bartek')).toBeNull()
  })

  // `3c`: in a one-person event every present is theirs, so no "for <name>".
  it('names no recipient in a many-to-one event', function () {
    const birthday: EventDoc = {
      ...event,
      type: 'many-to-one',
      beneficiaryParticipantId: 'pDziadek',
    }
    const claimed = item({
      kind: 'gift-claimed',
      actorParticipantId: 'pOla',
      recipientParticipantId: 'pDziadek',
      giftId: 'g1',
      giftTitle: 'Slippers',
    })
    const suggested = item({ ...claimed, kind: 'gift-added' })

    expect(activityLine(birthday, claimed, 'bartek')).toEqual({
      kind: 'claimed',
      actorId: 'pOla',
      giftId: 'g1',
      giftTitle: 'Slippers',
    })
    expect(activityLine(birthday, suggested, 'bartek')).toEqual({
      kind: 'suggested',
      actorId: 'pOla',
      giftId: 'g1',
      giftTitle: 'Slippers',
    })
  })
})

describe('activityLines', function () {
  it('pairs each item the viewer may see with its line, in order', function () {
    const joined = item({})
    const hidden = item({
      kind: 'gift-claimed',
      actorParticipantId: 'pOla',
      recipientParticipantId: 'pBartek',
      giftId: 'g1',
      giftTitle: 'Wool scarf',
    })
    const later = item({ actorParticipantId: 'pOla' })

    expect(activityLines(event, [joined, hidden, later], 'bartek')).toEqual([
      { item: joined, line: { kind: 'joined', actorId: 'pBartek' } },
      { item: later, line: { kind: 'joined', actorId: 'pOla' } },
    ])
  })
})

const gift = (
  forParticipantId: string,
  claimedBy: string[] | undefined,
): GiftDoc =>
  ({
    _id: `g${++seq}`,
    eventId: 'e1',
    forParticipantId,
    title: 'Present',
    createdBy: 'ola',
    createdAt: new Date('2026-09-02'),
    ...(claimedBy ? { claimedBy } : {}),
  }) as GiftDoc

describe('buyerSummary', function () {
  it('counts the presents with at least one buyer', function () {
    const gifts = [
      gift('pBartek', ['ola']),
      gift('pDziadek', ['ola', 'bartek']),
      gift('pDziadek', []),
    ]

    expect(buyerSummary(event, gifts, 'ola')).toEqual({
      withBuyer: 2,
      total: 3,
    })
  })

  // Claim-quietly rule: their own copies carry no claim state, so counting
  // them would read as "nobody is buying yours".
  it("leaves out the viewer's own presents", function () {
    const gifts = [gift('pBartek', undefined), gift('pDziadek', ['ola'])]

    expect(buyerSummary(event, gifts, 'bartek')).toEqual({
      withBuyer: 1,
      total: 1,
    })
  })
})

describe('timeAgo', function () {
  const now = new Date('2026-10-01T15:00:00')
  const at = (iso: string) => timeAgo(new Date(iso), now)

  it('says "just now" under a minute, and for a clock running ahead', function () {
    expect(at('2026-10-01T14:59:30')).toEqual({ kind: 'now' })
    expect(at('2026-10-01T15:02:00')).toEqual({ kind: 'now' })
  })

  it('counts minutes, then hours, within the last day', function () {
    expect(at('2026-10-01T14:15:00')).toEqual({ kind: 'minute', count: 45 })
    expect(at('2026-10-01T13:00:00')).toEqual({ kind: 'hour', count: 2 })
    expect(at('2026-09-30T16:00:00')).toEqual({ kind: 'hour', count: 23 })
  })

  it('counts calendar days past a day, up to a week', function () {
    expect(at('2026-09-30T14:00:00')).toEqual({ kind: 'yesterday' })
    expect(at('2026-09-29T23:00:00')).toEqual({ kind: 'day', count: 2 })
    expect(at('2026-09-25T09:00:00')).toEqual({ kind: 'day', count: 6 })
  })

  it('falls back to the date from a week on', function () {
    expect(at('2026-09-24T09:00:00')).toEqual({ kind: 'date' })
  })
})
