import type { LinkImportOutcome } from '@prezentowo/types'

import { type MeteorError, call, isNetworkError } from '@/sync'

// The server allows a shop 10 s a hop (docs/spec.md §3.2), so the default
// 15 s call timeout would give up on a slow but working import.
const IMPORT_TIMEOUT_MS = 20_000

/**
 * Resolves a pasted shop link with `gifts.importLink`. Never rejects: a link
 * the server can't parse is `unreadable`, and no answer, or any other
 * refusal, is an `infra-failure` worth trying again.
 */
export async function importLink(pasted: string): Promise<LinkImportOutcome> {
  try {
    return await call<LinkImportOutcome>(
      'gifts.importLink',
      { url: pasted.trim() },
      { timeoutMs: IMPORT_TIMEOUT_MS },
    )
  } catch (error) {
    if (isNetworkError(error)) return { outcome: 'infra-failure' }
    const { error: code } = (error ?? {}) as Partial<MeteorError>
    return code === 'invalidArgs'
      ? { outcome: 'unreadable' }
      : { outcome: 'infra-failure' }
  }
}

// How the blocked shop list's domains read in the inline note.
const SHOP_NAMES: Record<string, string> = {
  'allegro.pl': 'Allegro',
  'mediaexpert.pl': 'Media Expert',
}

export const blockedShopName = (domain: string): string =>
  SHOP_NAMES[domain] ?? domain
