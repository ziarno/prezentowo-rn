import type { TFunction } from 'i18next'

import { type Countdown, countdown, parseEventDate } from '@/api/eventList'

const countdownText = (t: TFunction, c: Countdown): string =>
  'unit' in c
    ? t(`home.countdown.${c.kind}.${c.unit}`, { count: c.count })
    : t(`home.countdown.${c.kind}`)

// An event's `YYYY-MM-DD` in `language`, e.g. "24 Dec 2026", or the raw
// string when it isn't a real date.
export function formatEventDate(language: string, date: string): string {
  const parsed = parseEventDate(date)
  return parsed
    ? new Intl.DateTimeFormat(language, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(parsed)
    : date
}

/**
 * An event's date for display (the raw string when it isn't a real date)
 * and how far it is from `now`, e.g. "in 3 weeks".
 */
export function eventWhen(
  t: TFunction,
  language: string,
  date: string,
  now: Date,
): { date: string; countdown?: string } {
  const until = countdown(date, now)
  return {
    date: formatEventDate(language, date),
    countdown: until && countdownText(t, until),
  }
}
