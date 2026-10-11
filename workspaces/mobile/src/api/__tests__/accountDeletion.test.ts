import { ACCOUNT_DELETION_CONSEQUENCES } from '@prezentowo/types'

import {
  deletionConsequences,
  emailMatches,
  isEmailMismatch,
} from '@/api/accountDeletion'

describe('emailMatches', () => {
  test('ignores case and surrounding spaces, as the server does', () => {
    expect(emailMatches(' Ola@Example.com ', 'ola@example.COM')).toBe(true)
  })

  test('is false for another address', () => {
    expect(emailMatches('ola@example.co', 'ola@example.com')).toBe(false)
  })

  test('is false for an empty field, or no known address', () => {
    expect(emailMatches('  ', '')).toBe(false)
    expect(emailMatches('ola@example.com', undefined)).toBe(false)
  })
})

describe('isEmailMismatch', () => {
  test('is the server rejecting the address', () => {
    expect(
      isEmailMismatch({ error: 'notAuthorized', reason: 'emailMismatch' }),
    ).toBe(true)
  })

  test('is false for any other failure', () => {
    expect(isEmailMismatch({ reason: 'mustBeLoggedIn' })).toBe(false)
    expect(isEmailMismatch(new Error('boom'))).toBe(false)
    expect(isEmailMismatch(undefined)).toBe(false)
  })
})

describe('deletionConsequences', () => {
  test('lists the same six items in each language', () => {
    expect(ACCOUNT_DELETION_CONSEQUENCES.en).toHaveLength(6)
    expect(ACCOUNT_DELETION_CONSEQUENCES.pl).toHaveLength(6)
  })

  test('is in the app language', () => {
    expect(deletionConsequences('pl')).toBe(ACCOUNT_DELETION_CONSEQUENCES.pl)
  })

  test('falls back to English for a language it has no text in', () => {
    expect(deletionConsequences('de')).toBe(ACCOUNT_DELETION_CONSEQUENCES.en)
  })
})
