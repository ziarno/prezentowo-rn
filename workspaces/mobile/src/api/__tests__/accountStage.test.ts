import { accountStage } from '@/api/accountStage'
import type { CurrentUser } from '@/api/users'

// The signed-in user's own document, as Meteor publishes it.
const own = (profile?: { name?: string }) => ({
  _id: 'u1',
  emails: [{ address: 'a@b.c', verified: true }],
  profile,
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

  it('opens the app for a user with a name, online or offline', () => {
    expect(signedIn(own({ name: 'Ala' }))).toBe('app')
    expect(signedIn(own({ name: 'Ala' }), true)).toBe('app')
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

  it('names the user from any publication that has the name', () => {
    expect(signedIn({ _id: 'u1', profile: { name: 'Ala' } })).toBe('app')
  })

  // A session on this device was signed in before; it never sees first-login
  // until the document says it should.
  it('opens the app offline when the document never arrived', () => {
    expect(signedIn({ _id: 'u1' }, true)).toBe('app')
    expect(signedIn(undefined, true)).toBe('app')
  })
})
