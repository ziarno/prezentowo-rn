import { todayUtc } from '@prezentowo/types'

let pinned: string | null = null

/**
 * "Today" for every age rule (docs/spec.md §1.15): the UTC calendar day as
 * `YYYY-MM-DD`, read at each check and never kept, so a user who turns 16
 * is searchable and can have push from that day on, with no job in between.
 */
export const today = () => pinned ?? todayUtc()

/**
 * Pins `today()` to `day`, or back to the real clock with `null`. For tests
 * that move across a birthday.
 */
export function pinToday(day: string | null) {
  pinned = day
}
