/// <reference types="jest" />
import {
  avatarPreview,
  daysUntil,
  parseEventDate,
  stablePick,
} from '../eventList'

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
  const noonOn = (y: number, m: number, d: number) =>
    new Date(y, m - 1, d, 12, 30)

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
