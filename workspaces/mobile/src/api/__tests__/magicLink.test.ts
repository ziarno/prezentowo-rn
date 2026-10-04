import { parseMagicLink } from '@/api/magicLink'
import { redirectSystemPath } from '@/app/+native-intent'

const link = 'prezentowo://magic-link?email=a%2Bb%40c.pl&token=t0k'

describe('parseMagicLink', () => {
  test('reads the email and token the backend puts in the link', () => {
    expect(parseMagicLink(link)).toEqual({ email: 'a+b@c.pl', token: 't0k' })
  })

  test.each([
    'prezentowo://magic-link?email=a%40b.pl',
    'prezentowo://magic-link?token=t0k',
    'prezentowo://e/AB12CD',
    'not a url',
  ])('%s is not a sign-in link', url => {
    expect(parseMagicLink(url)).toBeNull()
  })
})

describe('redirectSystemPath', () => {
  test('a magic link opening the app starts at the root', () => {
    expect(redirectSystemPath({ path: link, initial: true })).toBe('/')
  })

  test('a magic link while running skips navigation', () => {
    expect(redirectSystemPath({ path: link, initial: false })).toBeNull()
  })

  test('a broken magic link never reaches the router either', () => {
    const broken = 'prezentowo://magic-link?email=a%40b.pl'
    expect(redirectSystemPath({ path: broken, initial: true })).toBe('/')
    expect(redirectSystemPath({ path: broken, initial: false })).toBeNull()
  })

  test.each(['prezentowo://e/AB12CD', 'https://prezentowo.jarno.pl/e/AB12CD'])(
    'an invite link %s goes through unchanged',
    path => {
      expect(redirectSystemPath({ path, initial: true })).toBe(path)
      expect(redirectSystemPath({ path, initial: false })).toBe(path)
    },
  )
})
