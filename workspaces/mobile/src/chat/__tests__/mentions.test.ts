/// <reference types="jest" />
import type { EventParticipant } from '@prezentowo/types'

import { MENTION_MARK, composeMentions, mentionBlocker } from '../mentions'

const real = (id: string, userId: string): EventParticipant => ({
  id,
  kind: 'real',
  userId,
})
const placeholder = (
  id: string,
  departedUserId?: string,
): EventParticipant => ({
  id,
  kind: 'placeholder',
  name: id,
  color: '#000',
  departedUserId,
})

// Ola, Bartek and Cezary are real; Dziadek is a placeholder, and Ewa a
// deleted account's departed placeholder (docs/spec.md §1.12).
const event = {
  participants: [
    real('pOla', 'uOla'),
    real('pBartek', 'uBartek'),
    real('pCezary', 'uCezary'),
    placeholder('pDziadek'),
    placeholder('pEwa', 'uEwa'),
  ],
}

const eventThread = { kind: 'event' as const }
const bartekThread = {
  kind: 'secret' as const,
  recipientParticipantId: 'pBartek',
}

// A wish is added by its recipient; a suggestion by anyone else.
const wish = (participantId: string, userId: string) => ({
  forParticipantId: participantId,
  createdBy: userId,
})
const suggestion = (participantId: string) => ({
  forParticipantId: participantId,
  createdBy: 'uOla',
})

describe('mentionBlocker in the event thread', function () {
  it('blocks a suggestion for a real participant, naming them', function () {
    expect(mentionBlocker(suggestion('pBartek'), eventThread, event)).toBe(
      'pBartek',
    )
  })

  it("allows a real participant's own wish", function () {
    expect(
      mentionBlocker(wish('pBartek', 'uBartek'), eventThread, event),
    ).toBeNull()
  })

  it('allows anything for a placeholder or a departed placeholder', function () {
    for (const id of ['pDziadek', 'pEwa']) {
      expect(mentionBlocker(suggestion(id), eventThread, event)).toBeNull()
    }
    // A departed user's own wish keeps their `createdBy`.
    expect(mentionBlocker(wish('pEwa', 'uEwa'), eventThread, event)).toBeNull()
  })
})

describe("mentionBlocker in a person's secret thread", function () {
  it('allows suggestions and wishes for the person it is about', function () {
    expect(
      mentionBlocker(suggestion('pBartek'), bartekThread, event),
    ).toBeNull()
    expect(
      mentionBlocker(wish('pBartek', 'uBartek'), bartekThread, event),
    ).toBeNull()
  })

  it("allows other people's wishes", function () {
    expect(
      mentionBlocker(wish('pCezary', 'uCezary'), bartekThread, event),
    ).toBeNull()
  })

  it('blocks a suggestion for any other real participant', function () {
    expect(mentionBlocker(suggestion('pCezary'), bartekThread, event)).toBe(
      'pCezary',
    )
    // Ola adding one for herself is a wish; Cezary adding one for her isn't.
    expect(
      mentionBlocker(
        { forParticipantId: 'pOla', createdBy: 'uCezary' },
        bartekThread,
        event,
      ),
    ).toBe('pOla')
  })

  it('allows anything for a placeholder or a departed placeholder', function () {
    for (const id of ['pDziadek', 'pEwa']) {
      expect(mentionBlocker(suggestion(id), bartekThread, event)).toBeNull()
    }
  })
})

describe('composeMentions', function () {
  const lego = { giftId: 'g1', title: 'Lego Set' }
  const scarf = { giftId: 'g2', title: 'Scarf' }
  // How a stored mention reads: the icon and an invisible marker.
  const M = MENTION_MARK

  it('stores only the marker, and the titles for the push', function () {
    expect(
      composeMentions('what about 🎁Lego Set or 🎁Scarf?', [scarf, lego]),
    ).toEqual({
      text: `what about ${M} or ${M}?`,
      giftIds: ['g1', 'g2'],
      pushText: 'what about 🎁Lego Set or 🎁Scarf?',
    })
  })

  it('drops a pick whose mention was deleted from the text', function () {
    expect(composeMentions('maybe 🎁Scarf', [lego, scarf])).toEqual({
      text: `maybe ${M}`,
      giftIds: ['g2'],
      pushText: 'maybe 🎁Scarf',
    })
    // Nothing left: the text goes as written, with no push copy.
    expect(composeMentions('never mind', [lego])).toEqual({
      text: 'never mind',
      giftIds: [],
    })
  })

  it('lists a present once per mention, in order', function () {
    expect(composeMentions('🎁Scarf, yes, 🎁Scarf', [scarf, scarf])).toEqual({
      text: `${M}, yes, ${M}`,
      giftIds: ['g2', 'g2'],
      pushText: '🎁Scarf, yes, 🎁Scarf',
    })
  })

  it('matches the longest title where one starts another', function () {
    const legoBare = { giftId: 'g3', title: 'Lego' }
    expect(
      composeMentions('🎁Lego Set and 🎁Lego', [legoBare, lego]).giftIds,
    ).toEqual(['g1', 'g3'])
  })

  it('leaves a typed 🎁 alone, and a pasted marker becomes one', function () {
    expect(composeMentions(`a 🎁 for ${M}you`, [])).toEqual({
      text: 'a 🎁 for 🎁you',
      giftIds: [],
    })
  })

  it("keeps an edited message's mentions in place, with no push copy", function () {
    // An edit starts from the stored text, whose mentions are markers.
    expect(
      composeMentions(`🎁Scarf, ${M} or 🎁Scarf?`, [scarf], {
        giftIds: ['g1'],
      }),
    ).toEqual({ text: `${M}, ${M} or ${M}?`, giftIds: ['g2', 'g1', 'g2'] })
  })

  it("turns an edited message's mentions into plain 🎁 once one is deleted", function () {
    // Which marker went is unknown, so none of the old ones is trusted.
    expect(
      composeMentions(`${M} only, 🎁Scarf`, [scarf], { giftIds: ['g1', 'g3'] }),
    ).toEqual({ text: `🎁 only, ${M}`, giftIds: ['g2'] })
  })
})
