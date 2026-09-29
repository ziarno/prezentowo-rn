/// <reference types="jest" />
import {
  BACKGROUND_ILLUSTRATION_IDS,
  PRESENT_ILLUSTRATION_IDS,
} from '@prezentowo/types'

import {
  backgroundArt,
  backgroundTone,
  coverTone,
  presentArt,
} from '../stockArt'

const art = (id: string) => ({ kind: 'illustration', id }) as const

describe('presentArt', () => {
  it('shows the chosen present', () => {
    expect(presentArt(art('p3'), 'gift-1')).toBe('p3')
    expect(presentArt(art('p40'), 'gift-1')).toBe('p40')
  })

  it('falls back to a stable pick from the gift id when none is chosen', () => {
    const fallback = presentArt(undefined, 'gift-1')
    expect(PRESENT_ILLUSTRATION_IDS).toContain(fallback)
    expect(presentArt(undefined, 'gift-1')).toBe(fallback)
  })

  it('falls back for an id this build does not bundle', () => {
    const fallback = presentArt(undefined, 'gift-1')
    expect(presentArt(art('p41'), 'gift-1')).toBe(fallback)
    expect(presentArt(art('b3'), 'gift-1')).toBe(fallback)
  })

  it('spreads the fallback across the presents', () => {
    const picks = new Set(
      Array.from({ length: 200 }, (_, i) => presentArt(undefined, `g${i}`)),
    )
    expect(picks.size).toBeGreaterThan(20)
  })
})

describe('backgroundArt', () => {
  it('shows the chosen background', () => {
    expect(backgroundArt(art('b7'), 'evt-1')).toBe('b7')
  })

  it('falls back to a stable pick from the event id otherwise', () => {
    const fallback = backgroundArt(undefined, 'evt-1')
    expect(BACKGROUND_ILLUSTRATION_IDS).toContain(fallback)
    expect(backgroundArt(art('b21'), 'evt-1')).toBe(fallback)
    expect(backgroundArt(art('p3'), 'evt-1')).toBe(fallback)
  })
})

describe('backgroundTone', () => {
  it('is dark for the five dark patterns and light for the rest', () => {
    const dark = BACKGROUND_ILLUSTRATION_IDS.filter(
      id => backgroundTone(id) === 'dark',
    )
    expect(dark).toEqual(['b5', 'b8', 'b9', 'b14', 'b17'])
  })
})

describe('coverTone', () => {
  it('is the tone of the chosen or fallback pattern', () => {
    expect(coverTone(art('b5'), 'evt-1')).toBe('dark')
    expect(coverTone(art('b1'), 'evt-1')).toBe('light')
    expect(coverTone(undefined, 'evt-1')).toBe(
      backgroundTone(backgroundArt(undefined, 'evt-1')),
    )
  })

  it('is a photo for an upload or a picked photo', () => {
    expect(coverTone({ kind: 'upload', id: 'u1' }, 'evt-1')).toBe('photo')
    expect(coverTone({ kind: 'local', uri: 'file:///a.jpg' }, 'evt-1')).toBe(
      'photo',
    )
  })
})
