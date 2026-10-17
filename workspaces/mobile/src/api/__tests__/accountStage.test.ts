import { accountStage } from '@/api/accountStage'
import type { CurrentUser } from '@/api/users'

// The signed-in user's own document, as Meteor publishes it.
// `createdAt` comes with the second of the two publications that make up the
// own document, the one that also carries the date of birth.
const own = (profile?: { name?: string }, birthDate?: string) => ({
  _id: 'u1',
  createdAt: new Date('2026-10-01'),
  emails: [{ address: 'a@b.c', verified: true }],
  profile,
  ...(birthDate ? { birthDate } : {}),
})

const signedIn = (user: CurrentUser | undefined, offline = false) =>
  accountStage({ signedIn: true, user, offline })

describe('accountStage', () => {
  it('is signed out without a session', () => {
    expect(
      accountStage({
        signedIn: false,
        user: own({ name: 'Ala' }),
        offline: false,
      }),
    ).toBe('signedOut')
  })

  it('opens the app for a user with a name and a date of birth, online or offline', () => {
    expect(signedIn(own({ name: 'Ala' }, '1990-05-04'))).toBe('app')
    expect(signedIn(own({ name: 'Ala' }, '2012-01-02'))).toBe('app')
    expect(signedIn(own({ name: 'Ala' }, '2012-01-02'), true)).toBe('app')
  })

  // First-login also asks the date of birth, and so does an existing user once.
  it('asks the date of birth of a user with a name but no date', () => {
    expect(signedIn(own({ name: 'Ala' }))).toBe('firstLogin')
  })

  it('asks the date of birth of a user with neither', () => {
    expect(signedIn(own())).toBe('firstLogin')
  })

  // The profile and emails arrive before the publication that carries the
  // date; a user who has answered must not see the question in between.
  it('waits for the date while only the first publication is in', () => {
    const { createdAt: _, ...firstHalf } = own({ name: 'Ala' })
    expect(signedIn(firstHalf)).toBe('loading')
    expect(signedIn(firstHalf, true)).toBe('app')
  })

  it('asks for a name when the user has none', () => {
    expect(signedIn(own())).toBe('firstLogin')
    expect(signedIn(own({}))).toBe('firstLogin')
  })

  it('treats a blank name as none', () => {
    expect(signedIn(own({ name: '  ' }))).toBe('firstLogin')
  })

  it('waits for the user document online', () => {
    expect(signedIn(undefined)).toBe('loading')
  })

  // The offline cache keeps a bare `{ _id }` when the app closed before the
  // document arrived.
  it('waits for more than the bare id online', () => {
    expect(signedIn({ _id: 'u1' })).toBe('loading')
  })

  // Another publication's minimal profile, before the user's own document.
  it('waits for the own document when only a nameless profile is in', () => {
    expect(signedIn({ _id: 'u1', profile: {} })).toBe('loading')
  })

  it('waits for the own document when only a named profile is in', () => {
    expect(signedIn({ _id: 'u1', profile: { name: 'Ala' } })).toBe('loading')
  })

  // A session on this device was signed in before; it never sees first-login
  // until the document says it should.
  it('opens the app offline when the document never arrived', () => {
    expect(signedIn({ _id: 'u1' }, true)).toBe('app')
    expect(signedIn(undefined, true)).toBe('app')
  })
})
