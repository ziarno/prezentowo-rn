import { inviteCodeFromText, inviteLink } from '@/api/invites'

describe('inviteCodeFromText', () => {
  test('reads the link the app shares', () => {
    expect(inviteCodeFromText(inviteLink('aB3x'))).toBe('aB3x')
  })

  test('finds the link inside the whole share message', () => {
    expect(
      inviteCodeFromText(
        'Join “Wigilia 2026” on Prezentowo: https://prezentowo.jarno.pl/e/aB3x',
      ),
    ).toBe('aB3x')
  })

  test('takes the link without its scheme, or in another case', () => {
    expect(inviteCodeFromText('prezentowo.jarno.pl/e/aB3x')).toBe('aB3x')
    expect(inviteCodeFromText('HTTPS://Prezentowo.Jarno.pl/e/aB3x')).toBe(
      'aB3x',
    )
  })

  test('takes the app-scheme link', () => {
    expect(inviteCodeFromText('prezentowo://e/aB3x')).toBe('aB3x')
  })

  test('ignores surrounding whitespace, punctuation, a query or more path', () => {
    expect(
      inviteCodeFromText('  (https://prezentowo.jarno.pl/e/aB3x).\n'),
    ).toBe('aB3x')
    expect(
      inviteCodeFromText('https://prezentowo.jarno.pl/e/aB3x/?utm=chat'),
    ).toBe('aB3x')
  })

  test('takes the first of several links', () => {
    expect(
      inviteCodeFromText(
        'prezentowo.jarno.pl/e/aaaa or prezentowo.jarno.pl/e/bbbb',
      ),
    ).toBe('aaaa')
  })

  test('is null without an invite link', () => {
    expect(inviteCodeFromText('')).toBeNull()
    expect(inviteCodeFromText('aB3x')).toBeNull()
    expect(inviteCodeFromText('https://prezentowo.jarno.pl/privacy')).toBeNull()
    expect(inviteCodeFromText('https://prezentowo.jarno.pl/e/')).toBeNull()
    expect(inviteCodeFromText('https://example.com/e/aB3x')).toBeNull()
    expect(inviteCodeFromText('https://prezentowoXjarno.pl/e/aB3x')).toBeNull()
  })
})
