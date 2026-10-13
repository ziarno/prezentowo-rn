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

// What a mention of a present is in a message's stored text. Its title is
// never stored: a later member may not be allowed to see the present, so the
// app draws it from the viewer's own `gifts.byEvent` instead.
export const MENTION_TOKEN = '🎁'

// A present picked in the composer, shown there by its title.
export type MentionPick = { giftId: string; title: string }

export const mentionText = (title: string) => `${MENTION_TOKEN}${title}`

export type ComposedMentions = {
  text: string
  // The mentioned presents, in the order they appear, each once.
  giftIds: string[]
  // The text as written, titles included, for the push only. Cleared from
  // the message once it's sent.
  pushText?: string
}

/**
 * The message a composer's `text` sends: every picked present whose
 * `🎁Title` is still in the text becomes a bare `🎁`, and its id is listed.
 * An edit keeps the `edited` message's ids while a `🎁` is left, and has no
 * push copy: only a new message pushes.
 */
export function composeMentions(
  text: string,
  picks: MentionPick[],
  edited?: { giftIds?: string[] },
): ComposedMentions {
  // Longest first, so `🎁Lego Set` wins over `🎁Lego` where both match.
  const candidates = [...picks].sort((a, b) => b.title.length - a.title.length)
  const giftIds: string[] = []
  let stored = ''
  let rest = text
  for (;;) {
    let found: { at: number; token: string; giftId: string } | undefined
    for (const pick of candidates) {
      const token = mentionText(pick.title)
      const at = rest.indexOf(token)
      if (at >= 0 && (!found || at < found.at))
        found = { at, token, giftId: pick.giftId }
    }
    if (!found) break
    stored += rest.slice(0, found.at) + MENTION_TOKEN
    rest = rest.slice(found.at + found.token.length)
    if (!giftIds.includes(found.giftId)) giftIds.push(found.giftId)
  }
  stored += rest
  if (edited) {
    // Which bare `🎁` was which is unknown, so the old ones are kept while
    // any is left.
    const kept = stored.includes(MENTION_TOKEN) ? (edited.giftIds ?? []) : []
    return {
      text: stored,
      giftIds: [...kept, ...giftIds.filter(id => !kept.includes(id))],
    }
  }
  if (stored === text) return { text: stored, giftIds }
  return { text: stored, giftIds, pushText: text }
}
