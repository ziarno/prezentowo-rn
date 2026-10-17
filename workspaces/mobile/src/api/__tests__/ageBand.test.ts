import { AGE_ANSWERS, AGE_BANDS, isSixteenPlus } from '@prezentowo/types'

describe('isSixteenPlus', () => {
  it('is true only for the 16+ band', () => {
    expect(isSixteenPlus({ ageBand: '16+' })).toBe(true)
    expect(isSixteenPlus({ ageBand: '13-15' })).toBe(false)
  })

  // Someone who hasn't answered the age question yet is treated like the
  // youngest band.
  it('is false with no band, or no user', () => {
    expect(isSixteenPlus({})).toBe(false)
    expect(isSixteenPlus(undefined)).toBe(false)
    expect(isSixteenPlus(null)).toBe(false)
  })
})

describe('the age answers', () => {
  it('store two bands, and offer under 13 only as a way out', () => {
    expect(AGE_BANDS).toEqual(['13-15', '16+'])
    expect(AGE_ANSWERS).toEqual(['under-13', '13-15', '16+'])
  })
})
