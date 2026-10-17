import {
  AGE_ANSWERS,
  AGE_BANDS,
  type AgeAnswer,
  type SetAgeBandResult,
  isSixteenPlus,
} from '@prezentowo/types'

import { answerAgeQuestion } from '@/api/ageBand'

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

describe('answerAgeQuestion', () => {
  const setup = (reply: () => Promise<SetAgeBandResult>) => {
    const stop: boolean[] = []
    const send = jest.fn((_answer: AgeAnswer) => reply())
    return {
      stop,
      send,
      answer: (value: AgeAnswer) =>
        answerAgeQuestion(value, send, on => stop.push(on)),
    }
  }

  it('shows the stop message at once on under 13, and keeps it once the account is gone', async () => {
    const { stop, answer } = setup(async () => ({ deleted: true }))

    expect(await answer('under-13')).toBe('stopped')
    expect(stop).toEqual([true])
  })

  // The account already had a band: the server deleted nothing, so the
  // person must not be told they can't have one.
  it('takes the stop message back when the server deleted nothing', async () => {
    const { stop, answer } = setup(async () => ({ deleted: false }))

    expect(await answer('under-13')).toBe('continue')
    expect(stop).toEqual([true, false])
  })

  it('takes the stop message back when the call fails, and rethrows', async () => {
    const { stop, answer } = setup(() => Promise.reject(new Error('offline')))

    await expect(answer('under-13')).rejects.toThrow('offline')
    expect(stop).toEqual([true, false])
  })

  it.each(['13-15', '16+'] as const)(
    'never shows it for %s, and goes on',
    async value => {
      const { stop, send, answer } = setup(async () => ({ deleted: false }))

      expect(await answer(value)).toBe('continue')
      expect(send).toHaveBeenCalledWith(value)
      expect(stop).toEqual([])
    },
  )
})
