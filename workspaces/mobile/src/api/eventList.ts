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

// Calendar days from `now` to the event: 0 on the day, negative once past.
export function daysUntil(date: string, now: Date): number | undefined {
  const target = parseEventDate(date)
  if (!target) return undefined
  // Via UTC, so a DST change in between doesn't leave a 23 or 25 hour day.
  const utcDay = (d: Date) =>
    Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
  return Math.round((utcDay(target) - utcDay(now)) / DAY_MS)
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
