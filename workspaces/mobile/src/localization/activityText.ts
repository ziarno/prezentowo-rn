import type { TFunction } from 'i18next'

import { type ActivityLine, timeAgo } from '@/api/activityFeed'

const KEY_BASE: Record<ActivityLine['kind'], string> = {
  joined: 'joined',
  'self-added': 'selfAdded',
  suggested: 'suggested',
  claimed: 'claimed',
  unclaimed: 'unclaimed',
}

/**
 * The translation key for a feed (`3c`) line, with a "for <name>" and a "You"
 * variant.
 */
export function activityKey(line: ActivityLine, actorIsYou: boolean): string {
  const forRecipient = 'recipientId' in line && line.recipientId ? 'For' : ''
  return `activity.feed.${KEY_BASE[line.kind]}${forRecipient}${
    actorIsYou ? 'You' : ''
  }`
}

/**
 * When an item happened: "2 hours ago", and the date from a week on.
 */
export function activityTime(
  t: TFunction,
  language: string,
  at: Date,
  now: Date,
): string {
  const ago = timeAgo(at, now)
  if (ago.kind === 'date') {
    return new Intl.DateTimeFormat(language, {
      day: 'numeric',
      month: 'short',
      ...(at.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
    }).format(at)
  }
  return 'count' in ago
    ? t(`activity.ago.${ago.kind}`, { count: ago.count })
    : t(`activity.ago.${ago.kind}`)
}
