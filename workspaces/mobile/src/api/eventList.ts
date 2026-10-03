import dayjs from 'dayjs'

// Pure helpers behind Home's event rows (`3a`).

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/
const DAY_MS = 24 * 60 * 60 * 1000

// An event's `YYYY-MM-DD` as local midnight, or undefined when it isn't a
// real calendar date. `new Date('YYYY-MM-DD')` would read it as UTC.
export function parseEventDate(date: string): Date | undefined {
  const match = DATE_RE.exec(date)
  if (!match) return undefined
  const [year, month, day] = match.slice(1).map(Number) as [
    number,
    number,
    number,
  ]
  const parsed = new Date(year, month - 1, day)
  return parsed.getMonth() === month - 1 && parsed.getDate() === day
    ? parsed
    : undefined
}

// A picked day as the `YYYY-MM-DD` the server takes, from its local
// year/month/day: `toISOString()` would move it a day in some time zones.
export const toEventDate = (date: Date): string =>
  dayjs(date).format('YYYY-MM-DD')

// Calendar days from `now` to the event: 0 on the day, negative once past.
export function daysUntil(date: string, now: Date): number | undefined {
  const target = parseEventDate(date)
  if (!target) return undefined
  // Via UTC, so a DST change in between doesn't leave a 23 or 25 hour day.
  const utcDay = (d: Date) =>
    Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
  return Math.round((utcDay(target) - utcDay(now)) / DAY_MS)
}

export type CountdownUnit = 'day' | 'week' | 'month' | 'year'

export type Countdown =
  | { kind: 'today' | 'tomorrow' | 'yesterday' }
  | { kind: 'in' | 'ago'; unit: CountdownUnit; count: number }

// How far the event is, coarsened to the largest whole unit: days under a
// week, weeks under a calendar month, months under a year, then years. Counts
// are rounded within the unit, and 12 months becomes a year.
export function countdown(date: string, now: Date): Countdown | undefined {
  const days = daysUntil(date, now)
  if (days === undefined) return undefined
  if (days === 0) return { kind: 'today' }
  if (days === 1) return { kind: 'tomorrow' }
  if (days === -1) return { kind: 'yesterday' }

  const kind = days > 0 ? ('in' as const) : ('ago' as const)
  const at = (unit: CountdownUnit, count: number): Countdown => ({
    kind,
    unit,
    count,
  })
  const absDays = Math.abs(days)
  if (absDays < 7) return at('day', absDays)

  // Calendar-aware, so "1 month" is the same date next month.
  const months = Math.abs(
    dayjs(date).diff(dayjs(now).startOf('day'), 'month', true),
  )
  if (months < 1) return at('week', Math.round(absDays / 7))
  if (months < 12) {
    const rounded = Math.round(months)
    return rounded < 12 ? at('month', rounded) : at('year', 1)
  }
  return at('year', Math.round(months / 12))
}

// Home's order: upcoming events soonest first (today counts as upcoming),
// then past ones, latest first. An unreadable date sorts last.
export function sortForHome<T extends { date: string }>(
  events: readonly T[],
  now: Date,
): T[] {
  const today = dayjs(now).format('YYYY-MM-DD')
  const rank = (event: T) =>
    !parseEventDate(event.date) ? 2 : event.date >= today ? 0 : 1
  return [...events].sort((a, b) => {
    const byRank = rank(a) - rank(b)
    if (byRank !== 0 || rank(a) === 2) return byRank
    // `YYYY-MM-DD` compares correctly as a string.
    const byDate = a.date < b.date ? -1 : a.date > b.date ? 1 : 0
    return rank(a) === 0 ? byDate : -byDate
  })
}

// A stable pseudo-random option for `seed` (docs/spec.md §1.1 fallback):
// computed at render time from the document `_id`, never stored.
export function stablePick<T>(seed: string, options: readonly T[]): T {
  // FNV-1a, 32-bit.
  let hash = 0x811c9dc5
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return options[(hash >>> 0) % options.length] as T
}

// At most `max` slots: everyone when they fit, else `max - 1` people and a
// "+N" count in the last slot.
export function avatarPreview<T>(
  people: readonly T[],
  max: number,
): { shown: T[]; more: number } {
  if (people.length <= max) return { shown: [...people], more: 0 }
  const shown = people.slice(0, max - 1)
  return { shown, more: people.length - shown.length }
}
