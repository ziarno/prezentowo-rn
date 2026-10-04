/// <reference types="jest" />
import { isSearchableQuery as isSearchable } from '@prezentowo/types'

describe('isSearchableQuery', () => {
  it('needs 3 characters once folded, not counting spaces or hyphens', () => {
    expect(isSearchable('')).toBe(false)
    expect(isSearchable('Al')).toBe(false)
    expect(isSearchable(' a - b ')).toBe(false)
    expect(isSearchable('Ala')).toBe(true)
    expect(isSearchable('al b')).toBe(true)
  })

  it('counts a letter with a diacritic once', () => {
    expect(isSearchable('Łó')).toBe(false)
    expect(isSearchable('Łóż')).toBe(true)
  })
})
