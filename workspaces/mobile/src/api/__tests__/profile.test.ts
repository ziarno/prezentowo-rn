import {
  formatJoined,
  formatStat,
  legalPageUrl,
  versionLabel,
} from '@/api/profile'

describe('legalPageUrl', () => {
  test.each([
    ['privacy', 'pl', 'https://prezentowo.jarno.pl/privacy?lang=pl'],
    ['terms', 'en', 'https://prezentowo.jarno.pl/terms?lang=en'],
  ] as const)('%s in %s', (page, lang, url) => {
    expect(legalPageUrl(page, lang)).toBe(url)
  })
})

describe('versionLabel', () => {
  test('is the version with its build', () => {
    expect(versionLabel('1.2.0', '42')).toBe('1.2.0 (42)')
  })

  test('drops a build it has no number for', () => {
    expect(versionLabel('1.2.0', null)).toBe('1.2.0')
  })

  test('is null without a version', () => {
    expect(versionLabel(null, '42')).toBeNull()
  })
})

describe('formatJoined', () => {
  test("is the short month and two-digit year, as in Aug '26", () => {
    expect(formatJoined(new Date(2026, 7, 14), 'en')).toBe("Aug '26")
  })

  test('takes the stored ISO string too', () => {
    expect(formatJoined('2025-01-20T10:00:00.000Z', 'en')).toBe("Jan '25")
  })

  test.each([undefined, 'not a date'])('is null for %s', createdAt => {
    expect(formatJoined(createdAt, 'en')).toBeNull()
  })
})

describe('formatStat', () => {
  test.each([
    [0, '00'],
    [4, '04'],
    [17, '17'],
    [100, '100'],
    [2048, '2048'],
  ])('%i is %s', (count, label) => {
    expect(formatStat(count)).toBe(label)
  })

  test('is a dash when nothing is known', () => {
    expect(formatStat(undefined)).toBe('—')
  })
})
