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
 * The translation key for a line: the feed's (`3c`) full sentence or Home's
 * (`3a`) compact one, with a "for <name>" and a "You" variant.
 */
export function activityKey(
  line: ActivityLine,
  variant: 'feed' | 'home',
  actorIsYou: boolean,
): string {
  const forRecipient = 'recipientId' in line && line.recipientId ? 'For' : ''
  return `activity.${variant}.${KEY_BASE[line.kind]}${forRecipient}${
    actorIsYou ? 'You' : ''
  }`
}

/**
 * When an item happened: "2 hours ago" in the feed, "2h" on Home, and the
 * date from a week on.
 */
export function activityTime(
  t: TFunction,
  language: string,
  at: Date,
  now: Date,
  variant: 'feed' | 'home',
): string {
  const ago = timeAgo(at, now)
  if (ago.kind === 'date') {
    return new Intl.DateTimeFormat(language, {
      day: 'numeric',
      month: 'short',
      ...(at.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
    }).format(at)
  }
  if (variant === 'home') {
    if ('count' in ago)
      return t(`activity.agoShort.${ago.kind}`, { count: ago.count })
    return ago.kind === 'yesterday'
      ? t('activity.agoShort.day', { count: 1 })
      : t('activity.agoShort.now')
  }
  return 'count' in ago
    ? t(`activity.ago.${ago.kind}`, { count: ago.count })
    : t(`activity.ago.${ago.kind}`)
}
