/// <reference types="jest" />
import type { NotificationDoc } from '@prezentowo/types'

import {
  inboxSections,
  inboxTime,
  notificationTarget,
} from '../notificationInbox'

const now = new Date('2026-10-02T12:00:00')
const HOUR_MS = 60 * 60 * 1000
const hoursAgo = (h: number) => new Date(now.getTime() - h * HOUR_MS)

let seq = 0
const notification = (
  fields: Partial<NotificationDoc> & { hoursAgo?: number },
): NotificationDoc => {
  const { hoursAgo: h = 1, ...rest } = fields
  return {
    _id: `n${++seq}`,
    userId: 'ola',
    kind: 'participant-joined',
    eventId: 'e1',
    joinedParticipantId: 'pBartek',
    read: true,
    createdAt: hoursAgo(h),
    ...rest,
  }
}

const readAtOpen = () => false

describe('inboxSections', function () {
  it('is empty with no notifications', function () {
    expect(inboxSections([], readAtOpen, now)).toEqual([])
  })

  it('splits rows into New, Earlier this week and Older, newest first, hiding empty sections', function () {
    const old = notification({ kind: 'invite-deferred', hoursAgo: 24 * 9 })
    const recent = notification({ kind: 'invite-deferred', hoursAgo: 30 })
    const unread = notification({ kind: 'invite-deferred', hoursAgo: 50 })
    const newer = notification({ kind: 'invite-deferred', hoursAgo: 2 })
    const wasUnread = (n: NotificationDoc) => n === unread

    const sections = inboxSections([old, recent, unread, newer], wasUnread, now)

    expect(sections).toEqual([
      {
        key: 'new',
        rows: [{ kind: 'single', notification: unread, isNew: true }],
      },
      {
        key: 'week',
        rows: [
          { kind: 'single', notification: newer, isNew: false },
          { kind: 'single', notification: recent, isNew: false },
        ],
      },
      {
        key: 'older',
        rows: [{ kind: 'single', notification: old, isNew: false }],
      },
    ])
  })

  it("coalesces a section's joins for one event into a row at the newest join", function () {
    const join1 = notification({ joinedParticipantId: 'p1', hoursAgo: 5 })
    const claim = notification({
      kind: 'suggestion-claimed',
      giftId: 'g1',
      hoursAgo: 4,
    })
    const join2 = notification({ joinedParticipantId: 'p2', hoursAgo: 3 })
    const otherEvent = notification({ eventId: 'e2', hoursAgo: 2 })
    const join3 = notification({ joinedParticipantId: 'p3', hoursAgo: 1 })

    const [week] = inboxSections(
      [join1, claim, join2, otherEvent, join3],
      readAtOpen,
      now,
    )

    expect(week!.rows).toEqual([
      {
        kind: 'joins',
        eventId: 'e1',
        joins: [join3, join2, join1],
        isNew: false,
      },
      { kind: 'single', notification: otherEvent, isNew: false },
      { kind: 'single', notification: claim, isNew: false },
    ])
  })

  it('never coalesces joins across sections', function () {
    const fresh = notification({ hoursAgo: 1 })
    const seen = notification({ hoursAgo: 2 })

    const sections = inboxSections([fresh, seen], n => n === fresh, now)

    expect(sections.map(s => s.rows.map(r => r.kind))).toEqual([
      ['single'],
      ['single'],
    ])
  })

  it('never coalesces the other kinds', function () {
    const rows = inboxSections(
      [
        notification({ kind: 'claimed-gift-removed', giftTitle: 'Mug' }),
        notification({ kind: 'claimed-gift-removed', giftTitle: 'Pipe' }),
      ],
      readAtOpen,
      now,
    )[0]!.rows

    expect(rows.map(r => r.kind)).toEqual(['single', 'single'])
  })
})

describe('inboxTime', function () {
  it.each([
    [0.2, { kind: 'now' }],
    [0.9, { kind: 'now' }],
    [3, { kind: 'hour', count: 3 }],
    [30, { kind: 'yesterday' }],
    [24 * 4, { kind: 'day', count: 4 }],
    [24 * 7, { kind: 'week', count: 1 }],
    [24 * 15, { kind: 'week', count: 2 }],
  ])('reads %p hours ago as %p', function (h, expected) {
    expect(inboxTime(hoursAgo(h), now)).toEqual(expected)
  })
})

describe('notificationTarget', function () {
  const known = { giftGone: false, recipientInEvent: true }

  it('opens 7a with the invite’s current code', function () {
    const n = notification({ kind: 'invite-deferred' })

    expect(notificationTarget(n, { ...known, inviteCode: 'Ab3x' })).toEqual({
      pathname: '/e/[code]',
      params: { code: 'Ab3x' },
    })
  })

  it('opens nothing for an invite whose code is not known yet', function () {
    const n = notification({ kind: 'invite-deferred' })

    expect(notificationTarget(n, known)).toBeNull()
  })

  it('opens the claimed present', function () {
    const n = notification({
      kind: 'suggestion-claimed',
      giftId: 'g1',
      recipientParticipantId: 'pDziadek',
    })

    expect(notificationTarget(n, known)).toEqual({
      pathname: '/event/[eventId]/gift/[giftId]',
      params: { eventId: 'e1', giftId: 'g1' },
    })
  })

  it("opens the recipient's list once the claimed present is gone", function () {
    const n = notification({
      kind: 'suggestion-claimed',
      giftId: 'g1',
      recipientParticipantId: 'pDziadek',
    })

    expect(notificationTarget(n, { ...known, giftGone: true })).toEqual({
      pathname: '/event/[eventId]/person/[participantId]',
      params: { eventId: 'e1', participantId: 'pDziadek' },
    })
  })

  it('falls back to the feed once the recipient is gone too', function () {
    const n = notification({
      kind: 'suggestion-claimed',
      giftId: 'g1',
      recipientParticipantId: 'pDziadek',
    })

    expect(
      notificationTarget(n, { giftGone: true, recipientInEvent: false }),
    ).toEqual({ pathname: '/event/[eventId]', params: { eventId: 'e1' } })
  })

  it('opens the feed for a join', function () {
    expect(notificationTarget(notification({}), known)).toEqual({
      pathname: '/event/[eventId]',
      params: { eventId: 'e1' },
    })
  })

  it("opens the removed present's recipient's list, or the feed without one", function () {
    const n = notification({
      kind: 'claimed-gift-removed',
      giftTitle: 'Pipe',
      recipientParticipantId: 'pDziadek',
    })

    expect(notificationTarget(n, known)).toEqual({
      pathname: '/event/[eventId]/person/[participantId]',
      params: { eventId: 'e1', participantId: 'pDziadek' },
    })
    expect(
      notificationTarget(n, { ...known, recipientInEvent: false }),
    ).toEqual({ pathname: '/event/[eventId]', params: { eventId: 'e1' } })
  })
})
