import type { SetBirthDateResult } from '@prezentowo/types'

import { answerBirthDate } from '@/api/birthDate'

describe('answerBirthDate', () => {
  const today = '2026-10-17'
  const setup = (reply: () => Promise<SetBirthDateResult>) => {
    const stop: boolean[] = []
    const send = jest.fn((_birthDate: string) => reply())
    return {
      stop,
      send,
      answer: (birthDate: string) =>
        answerBirthDate(birthDate, today, send, on => stop.push(on)),
    }
  }

  it('shows the stop message at once for an under-13 date, and keeps it once the account is gone', async () => {
    const { stop, answer } = setup(async () => ({ deleted: true }))

    expect(await answer('2013-10-18')).toBe('stopped')
    expect(stop).toEqual([true])
  })

  // The account already had a date: the server deleted nothing, so the
  // person must not be told they can't have one.
  it('takes the stop message back when the server deleted nothing', async () => {
    const { stop, answer } = setup(async () => ({ deleted: false }))

    expect(await answer('2013-10-18')).toBe('continue')
    expect(stop).toEqual([true, false])
  })

  it('takes the stop message back when the call fails, and rethrows', async () => {
    const { stop, answer } = setup(() => Promise.reject(new Error('offline')))

    await expect(answer('2013-10-18')).rejects.toThrow('offline')
    expect(stop).toEqual([true, false])
  })

  it('never shows it for someone who is 13 today, and goes on', async () => {
    const { stop, send, answer } = setup(async () => ({ deleted: false }))

    expect(await answer('2013-10-17')).toBe('continue')
    expect(send).toHaveBeenCalledWith('2013-10-17')
    expect(stop).toEqual([])
  })

  // The phone's clock is a day behind the server's: the server deleted, so
  // the stop message goes up after all.
  it('shows it when the server deleted an account the phone took for 13', async () => {
    const { stop, answer } = setup(async () => ({ deleted: true }))

    expect(await answer('2013-10-17')).toBe('stopped')
    expect(stop).toEqual([true])
  })
})
