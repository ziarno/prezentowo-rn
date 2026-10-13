import type { ChatThreadDoc, EventDoc, GiftDoc } from '@prezentowo/types'

import { isHiddenFrom } from '@/api/presentLists'

/**
 * The participant who stops `gift` being mentioned in `thread`, by id, or
 * null when it can be: a present can be mentioned only if every member can
 * see it. Members are the real participants: all of them in the event
 * thread, all but the person a secret thread is about (docs/spec.md §2.4).
 * Who can't see a present is the own-list visibility rule's (§2.3).
 */
export function mentionBlocker(
  gift: Pick<GiftDoc, 'forParticipantId' | 'createdBy'>,
  thread: Pick<ChatThreadDoc, 'kind' | 'recipientParticipantId'>,
  event: Pick<EventDoc, 'participants'>,
): string | null {
  const blocker = event.participants.find(
    p =>
      p.kind === 'real' &&
      !(thread.kind === 'secret' && thread.recipientParticipantId === p.id) &&
      isHiddenFrom(event, gift, p.userId),
  )
  return blocker?.id ?? null
}

// The icon a mention shows with: in the composer as `🎁Title`, and as the
// picker's button.
export const MENTION_ICON = '🎁'

// What a mention of a present is in a message's stored text: the icon and
// an invisible word joiner, which a typed 🎁 never has. Its title is never
// stored: a later member may not be allowed to see the present, so the app
// draws it from the viewer's own `gifts.byEvent` instead.
export const MENTION_MARK = `${MENTION_ICON}⁠`

// A present picked in the composer, shown there by its title.
export type MentionPick = { giftId: string; title: string }

export const mentionText = (title: string) => `${MENTION_ICON}${title}`

export type ComposedMentions = {
  text: string
  // The present each `MENTION_MARK` in `text` stands for, in order.
  giftIds: string[]
  // The text as written, titles included, for the push only. Cleared from
  // the message once it's sent.
  pushText?: string
}

/**
 * The message a composer's `text` sends: every picked present whose
 * `🎁Title` is still in the text becomes a `MENTION_MARK`, and its id is
 * listed where it stands. A marker pasted from another message is only a
 * 🎁. An edit keeps the `edited` message's markers, unless one was deleted:
 * which one is unknown, so they all become a 🎁. Only a new message pushes,
 * so an edit has no push copy.
 */
export function composeMentions(
  text: string,
  picks: MentionPick[],
  edited?: { giftIds?: string[] },
): ComposedMentions {
  const old = edited?.giftIds ?? []
  const keepOld = !!edited && text.split(MENTION_MARK).length - 1 === old.length
  // Longest first, so `🎁Lego Set` wins over `🎁Lego` where both match.
  const tokens = [...picks]
    .sort((a, b) => b.title.length - a.title.length)
    .map(pick => ({ token: mentionText(pick.title), giftId: pick.giftId }))
  tokens.push({ token: MENTION_MARK, giftId: '' })

  const giftIds: string[] = []
  let oldIndex = 0
  let stored = ''
  let rest = text
  for (;;) {
    let found: { at: number; token: string; giftId: string } | undefined
    for (const candidate of tokens) {
      const at = rest.indexOf(candidate.token)
      if (at >= 0 && (!found || at < found.at)) found = { at, ...candidate }
    }
    if (!found) break
    stored += rest.slice(0, found.at)
    rest = rest.slice(found.at + found.token.length)
    if (found.token !== MENTION_MARK) {
      stored += MENTION_MARK
      giftIds.push(found.giftId)
    } else if (keepOld) {
      stored += MENTION_MARK
      giftIds.push(old[oldIndex++])
    } else {
      stored += MENTION_ICON
    }
  }
  stored += rest
  const pushText = text.split(MENTION_MARK).join(MENTION_ICON)
  if (edited || !giftIds.length) return { text: stored, giftIds }
  return { text: stored, giftIds, pushText }
}

// Where each mention is in a composer's text, left to right: a picked
// present's `🎁Title` (longest first, as `composeMentions` reads them), or a
// sent one's marker while its message is edited.
export function mentionRanges(
  text: string,
  picks: MentionPick[],
): { start: number; end: number }[] {
  const tokens = [
    ...[...picks]
      .sort((a, b) => b.title.length - a.title.length)
      .map(pick => mentionText(pick.title)),
    MENTION_MARK,
  ]
  const ranges: { start: number; end: number }[] = []
  let from = 0
  for (;;) {
    let found: { start: number; end: number } | undefined
    for (const token of tokens) {
      const at = text.indexOf(token, from)
      if (at >= 0 && (!found || at < found.start))
        found = { start: at, end: at + token.length }
    }
    if (!found) return ranges
    ranges.push(found)
    from = found.end
  }
}

/**
 * Keeps mentions whole while the composer's text goes from `prev` to `next`,
 * so they act like tags: an edit that deletes any of a mention deletes all of
 * it, and text typed inside one goes just after it. Returns the text and
 * caret to use instead, or null when `next` touches no mention.
 */
export function keepMentionsWhole(
  prev: string,
  next: string,
  picks: MentionPick[],
): { text: string; caret: number } | null {
  const shorter = Math.min(prev.length, next.length)
  let start = 0
  while (start < shorter && prev[start] === next[start]) start++
  let tail = 0
  while (
    tail < shorter - start &&
    prev[prev.length - 1 - tail] === next[next.length - 1 - tail]
  )
    tail++
  const removedEnd = prev.length - tail
  const inserted = next.slice(start, next.length - tail)
  const ranges = mentionRanges(prev, picks)

  if (removedEnd === start) {
    const inside = ranges.find(r => r.start < start && start < r.end)
    if (!inside) return null
    return {
      text: prev.slice(0, inside.end) + inserted + prev.slice(inside.end),
      caret: inside.end + inserted.length,
    }
  }
  const hit = ranges.filter(r => start < r.end && removedEnd > r.start)
  if (!hit.length) return null
  const from = Math.min(start, hit[0].start)
  const to = Math.max(removedEnd, hit[hit.length - 1].end)
  return {
    text: prev.slice(0, from) + inserted + prev.slice(to),
    caret: from + inserted.length,
  }
}

// Markdown can't match a mention by its icon, which its text rule reads as
// a letter, so for rendering the i-th marker becomes `\u0001i\u0001`.
const RENDER_MARK = '\u0001'
export const RENDERED_MENTION = /^\u0001(\d+)\u0001/

export function renderableMentions(text: string): string {
  let index = 0
  return text
    .split(RENDER_MARK)
    .join('')
    .split(MENTION_MARK)
    .reduce(
      (acc, part) => `${acc}${RENDER_MARK}${index++}${RENDER_MARK}${part}`,
    )
}
