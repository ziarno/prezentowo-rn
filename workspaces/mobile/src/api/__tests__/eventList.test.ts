/// <reference types="jest" />
import {
  avatarPreview,
  countdown,
  daysUntil,
  parseEventDate,
  sortForHome,
  stablePick,
} from '../eventList'

const noonOn = (y: number, m: number, d: number) =>
  new Date(y, m - 1, d, 12, 30)

describe('parseEventDate', () => {
  it('reads YYYY-MM-DD as local midnight, not UTC', () => {
    const date = parseEventDate('2026-12-24')
    expect(date).toBeDefined()
    expect(date!.getFullYear()).toBe(2026)
    expect(date!.getMonth()).toBe(11)
    expect(date!.getDate()).toBe(24)
    expect(date!.getHours()).toBe(0)
  })

  it('rejects anything that is not a real calendar date', () => {
    expect(parseEventDate('')).toBeUndefined()
    expect(parseEventDate('2026-13-01')).toBeUndefined()
    expect(parseEventDate('2026-02-30')).toBeUndefined()
    expect(parseEventDate('24.12.2026')).toBeUndefined()
  })
})

describe('daysUntil', () => {
  it('is 0 on the day, whatever the time', () => {
    expect(daysUntil('2026-12-24', noonOn(2026, 12, 24))).toBe(0)
    expect(daysUntil('2026-12-24', new Date(2026, 11, 24, 23, 59))).toBe(0)
  })

  it('counts calendar days ahead and behind', () => {
    expect(daysUntil('2026-12-24', noonOn(2026, 12, 23))).toBe(1)
    expect(daysUntil('2026-12-24', noonOn(2026, 11, 24))).toBe(30)
    expect(daysUntil('2026-12-24', noonOn(2026, 12, 26))).toBe(-2)
  })

  it('crosses a DST change without drifting', () => {
    // Europe's autumn change falls on the last Sunday of October.
    expect(daysUntil('2026-11-01', noonOn(2026, 10, 20))).toBe(12)
  })

  it('is undefined for an unreadable date', () => {
    expect(daysUntil('soon', noonOn(2026, 1, 1))).toBeUndefined()
  })
})

describe('stablePick', () => {
  const options = ['a', 'b', 'c', 'd'] as const

  it('picks the same option for the same seed every time', () => {
    expect(stablePick('evt-1', options)).toBe(stablePick('evt-1', options))
  })

  it('spreads different seeds across the options', () => {
    const picks = new Set(
      Array.from({ length: 40 }, (_, i) => stablePick(`evt-${i}`, options)),
    )
    expect(picks.size).toBe(options.length)
  })
})

describe('avatarPreview', () => {
  const people = ['a', 'b', 'c', 'd', 'e', 'f']

  it('shows everyone when they fit', () => {
    expect(avatarPreview(people.slice(0, 3), 4)).toEqual({
      shown: ['a', 'b', 'c'],
      more: 0,
    })
    expect(avatarPreview(people.slice(0, 4), 4)).toEqual({
      shown: ['a', 'b', 'c', 'd'],
      more: 0,
    })
  })

  it('gives the last slot to a "+N" count once they overflow', () => {
    expect(avatarPreview(people, 4)).toEqual({
      shown: ['a', 'b', 'c'],
      more: 3,
    })
  })
})

describe('countdown', () => {
  const now = noonOn(2026, 9, 29)
  const inUnit = (unit: string, count: number) => ({ kind: 'in', unit, count })
  const ago = (unit: string, count: number) => ({ kind: 'ago', unit, count })

  it('names the nearest days', () => {
    expect(countdown('2026-09-29', now)).toEqual({ kind: 'today' })
    expect(countdown('2026-09-30', now)).toEqual({ kind: 'tomorrow' })
    expect(countdown('2026-09-28', now)).toEqual({ kind: 'yesterday' })
  })

  it('counts days under a week', () => {
    expect(countdown('2026-10-02', now)).toEqual(inUnit('day', 3))
    expect(countdown('2026-10-05', now)).toEqual(inUnit('day', 6))
    expect(countdown('2026-09-26', now)).toEqual(ago('day', 3))
  })

  it('counts rounded weeks under a month', () => {
    expect(countdown('2026-10-06', now)).toEqual(inUnit('week', 1))
    expect(countdown('2026-10-09', now)).toEqual(inUnit('week', 1))
    expect(countdown('2026-10-12', now)).toEqual(inUnit('week', 2))
    expect(countdown('2026-10-20', now)).toEqual(inUnit('week', 3))
    expect(countdown('2026-10-28', now)).toEqual(inUnit('week', 4))
    expect(countdown('2026-09-08', now)).toEqual(ago('week', 3))
  })

  it('counts rounded calendar months under a year', () => {
    expect(countdown('2026-10-29', now)).toEqual(inUnit('month', 1))
    expect(countdown('2026-12-24', now)).toEqual(inUnit('month', 3))
    expect(countdown('2026-05-04', now)).toEqual(ago('month', 5))
  })

  it('counts rounded years from there, never "12 months"', () => {
    expect(countdown('2027-09-20', now)).toEqual(inUnit('year', 1))
    expect(countdown('2028-09-29', now)).toEqual(inUnit('year', 2))
    expect(countdown('2024-09-29', now)).toEqual(ago('year', 2))
  })

  it('is undefined for an unreadable date', () => {
    expect(countdown('soon', now)).toBeUndefined()
  })
})

describe('sortForHome', () => {
  const now = noonOn(2026, 9, 29)
  const event = (_id: string, date: string) => ({ _id, date })

  it('puts upcoming events first, soonest first, then past ones, latest first', () => {
    const sorted = sortForHome(
      [
        event('long-past', '2025-12-24'),
        event('far', '2027-05-01'),
        event('recent-past', '2026-09-28'),
        event('today', '2026-09-29'),
        event('soon', '2026-10-02'),
      ],
      now,
    )
    expect(sorted.map(e => e._id)).toEqual([
      'today',
      'soon',
      'far',
      'recent-past',
      'long-past',
    ])
  })

  it('keeps an unreadable date last, and does not mutate its input', () => {
    const input = [event('broken', 'soon'), event('soon', '2026-10-02')]
    expect(sortForHome(input, now).map(e => e._id)).toEqual(['soon', 'broken'])
    expect(input.map(e => e._id)).toEqual(['broken', 'soon'])
  })
})
