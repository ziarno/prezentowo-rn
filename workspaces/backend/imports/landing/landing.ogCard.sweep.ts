import { readdir, rm } from 'fs/promises'
import { join } from 'path'

import { Invites } from '../api/invites/invites.collection'
import { loadInvitePreview } from '../api/invites/invites.preview'
import { BRAND_CARD_FILE, cardFile, ogCardsDir } from './landing.ogCard'

// The cards a live invite is drawn with right now, and the brand card.
async function currentCards() {
  const current = new Set([BRAND_CARD_FILE])
  const codes = await Invites.find({}, { fields: { code: 1 } }).mapAsync(
    invite => invite.code,
  )
  for (const code of codes) {
    const invite = await loadInvitePreview(code)
    if (invite) current.add(cardFile(invite))
  }
  return current
}

/**
 * Deletes every cached card no live invite is drawn as any more: an old
 * title or inviter name, a rotated code, a deleted event, a retired design
 * (docs/spec.md §3.8). It's a cache, so a card deleted by mistake is just
 * rendered again on request. Only `.png` files are touched: a `.tmp` is a
 * card being written.
 */
export async function sweepStaleOgCards(): Promise<void> {
  const dir = ogCardsDir()
  const files = await readdir(dir).catch(error => {
    if (error.code === 'ENOENT') return []
    throw error
  })
  const cards = files.filter(file => file.endsWith('.png'))
  if (!cards.length) return
  const current = await currentCards()
  for (const file of cards) {
    if (current.has(file)) continue
    try {
      await rm(join(dir, file), { force: true })
    } catch (error) {
      console.error('Sweeping a stale OG card failed', error)
    }
  }
}
