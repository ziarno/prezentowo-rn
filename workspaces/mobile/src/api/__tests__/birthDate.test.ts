import {
  MAX_AGE,
  ageOn,
  birthDateProblem,
  earliestBirthDate,
  isIsoDate,
  isSixteenPlus,
  isUnder13,
  latestBirthDateAtAge,
  todayUtc,
} from '@prezentowo/types'

describe('todayUtc', () => {
  // The one time zone for "today" everywhere is UTC, whatever the clock's.
  it('reads the UTC calendar day, not the local one', () => {
    expect(todayUtc(new Date('2026-10-17T23:30:00-05:00'))).toBe('2026-10-18')
    expect(todayUtc(new Date('2026-10-17T00:30:00+02:00'))).toBe('2026-10-16')
    expect(todayUtc(new Date('2026-10-17T12:00:00Z'))).toBe('2026-10-17')
  })
})

describe('isIsoDate', () => {
  it('accepts real calendar days only', () => {
    expect(isIsoDate('2010-10-17')).toBe(true)
    expect(isIsoDate('2012-02-29')).toBe(true)
    for (const bad of [
      '2011-02-29',
      '2010-13-01',
      '2010-00-10',
      '2010-04-31',
      '2010-1-1',
      '10-10-2010',
      '2010-10-17T00:00:00Z',
      ' 2010-10-17',
      '',
      20101017,
      null,
      undefined,
    ]) {
      expect(isIsoDate(bad)).toBe(false)
    }
  })
})

describe('ageOn', () => {
  it('counts whole years, turning a year older on the birthday', () => {
    expect(ageOn('2010-10-17', '2026-10-16')).toBe(15)
    expect(ageOn('2010-10-17', '2026-10-17')).toBe(16)
    expect(ageOn('2010-10-17', '2026-12-31')).toBe(16)
    expect(ageOn('2026-10-17', '2026-10-17')).toBe(0)
  })

  // Born on Feb 29, the birthday falls on Mar 1 in a year with no Feb 29, the
  // later (conservative) of the two choices.
  it('puts a Feb 29 birthday on Mar 1 in non-leap years', () => {
    expect(ageOn('2012-02-29', '2027-02-28')).toBe(14)
    expect(ageOn('2012-02-29', '2027-03-01')).toBe(15)
    expect(ageOn('2012-02-29', '2028-02-28')).toBe(15)
    expect(ageOn('2012-02-29', '2028-02-29')).toBe(16)
  })
})

describe('isSixteenPlus', () => {
  // 15 years and 364 days old is not 16; one day later is, with no
  // migration or job in between.
  it('flips on the 16th birthday, computed against the given day', () => {
    const user = { birthDate: '2010-10-18' }

    expect(isSixteenPlus(user, '2026-10-17')).toBe(false)
    expect(isSixteenPlus(user, '2026-10-18')).toBe(true)
    expect(isSixteenPlus(user, '2040-01-01')).toBe(true)
  })

  it('makes a Feb 29 baby 16 on Feb 29 when the year has one', () => {
    const user = { birthDate: '2012-02-29' }
    expect(isSixteenPlus(user, '2028-02-28')).toBe(false)
    expect(isSixteenPlus(user, '2028-02-29')).toBe(true)
  })

  it('is false with no birth date, or no user', () => {
    expect(isSixteenPlus({}, '2026-10-17')).toBe(false)
    expect(isSixteenPlus(undefined, '2026-10-17')).toBe(false)
    expect(isSixteenPlus(null, '2026-10-17')).toBe(false)
  })
})

describe('isUnder13', () => {
  it('is true until the 13th birthday', () => {
    expect(isUnder13('2013-10-18', '2026-10-17')).toBe(true)
    expect(isUnder13('2013-10-17', '2026-10-17')).toBe(false)
  })

  it('is false when there is no date to judge', () => {
    expect(isUnder13(undefined, '2026-10-17')).toBe(false)
  })
})

describe('latestBirthDateAtAge', () => {
  // The search compares ISO strings: `birthDate <= cutoff` has to agree with
  // the age on every day, Feb 29 and the days around it included.
  it('agrees with ageOn on every day around the leap-year edges', () => {
    const days = (from: string, to: string) => {
      const out: string[] = []
      for (let t = Date.parse(from); t <= Date.parse(to); t += 86_400_000) {
        out.push(new Date(t).toISOString().slice(0, 10))
      }
      return out
    }
    const todays = [
      '2027-02-28',
      '2027-03-01',
      '2028-02-28',
      '2028-02-29',
      '2028-03-01',
      '2116-02-28',
      '2116-02-29',
      '2116-03-01',
    ]
    for (const today of todays) {
      const year = Number(today.slice(0, 4))
      const cutoff = latestBirthDateAtAge(16, today)
      for (const born of days(`${year - 17}-12-25`, `${year - 15}-01-05`)) {
        expect([born, today, born <= cutoff]).toEqual([
          born,
          today,
          ageOn(born, today) >= 16,
        ])
      }
    }
  })

  it('is today minus the years', () => {
    expect(latestBirthDateAtAge(16, '2026-10-17')).toBe('2010-10-17')
    expect(latestBirthDateAtAge(16, '2028-02-29')).toBe('2012-02-29')
  })

  it('stays a real date in a year with no Feb 29', () => {
    expect(latestBirthDateAtAge(16, '2116-02-29')).toBe('2100-02-28')
  })
})

describe('birthDateProblem', () => {
  const today = '2026-10-17'

  it('accepts a day from today back to 120 years ago', () => {
    expect(MAX_AGE).toBe(120)
    expect(earliestBirthDate(today)).toBe('1906-10-17')
    expect(birthDateProblem('2026-10-17', today)).toBeNull()
    expect(birthDateProblem('1990-05-04', today)).toBeNull()
    expect(birthDateProblem('1906-10-17', today)).toBeNull()
  })

  it('names what is wrong', () => {
    expect(birthDateProblem('1906-10-16', today)).toBe('tooOld')
    expect(birthDateProblem('2026-10-18', today)).toBe('future')
    expect(birthDateProblem('2027-01-01', today)).toBe('future')
    expect(birthDateProblem('2011-02-29', today)).toBe('malformed')
    expect(birthDateProblem('banana', today)).toBe('malformed')
    expect(birthDateProblem(undefined, today)).toBe('malformed')
    expect(birthDateProblem(20101017, today)).toBe('malformed')
  })
})
