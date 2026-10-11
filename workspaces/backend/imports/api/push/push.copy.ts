import type { AppLanguage, InboxPushData } from '@prezentowo/types'

// What an inbox push names: never more than its inbox row does
// (docs/spec.md §2.5). `actor` is the inviter, the joiner or the claimer.
export type PushNames = { actor: string; gift: string }

type PushCopy = {
  // A person who no longer resolves, as the inbox's "Someone".
  someone: string
  // The body under the event's title, per kind.
  body: Record<InboxPushData['kind'], (names: PushNames) => string>
}

// Inbox push text, in each device's language. Gift titles are quoted, since
// a push can't bold them the way the inbox row does.
export const PUSH_COPY: Record<AppLanguage, PushCopy> = {
  en: {
    someone: 'Someone',
    body: {
      invited: ({ actor }) => `${actor} invited you`,
      'participant-joined': ({ actor }) => `${actor} joined`,
      'suggestion-claimed': ({ actor, gift }) => `${actor} is buying “${gift}”`,
      'claimed-gift-removed': ({ gift }) => `“${gift}” was removed`,
    },
  },
  pl: {
    someone: 'Ktoś',
    body: {
      // Present tense, as in the inbox: the past would need a gender.
      invited: ({ actor }) => `${actor} zaprasza Cię`,
      'participant-joined': ({ actor }) => `${actor} dołącza`,
      'suggestion-claimed': ({ actor, gift }) => `${actor} kupuje „${gift}”`,
      'claimed-gift-removed': ({ gift }) => `Usunięto „${gift}”`,
    },
  },
}
