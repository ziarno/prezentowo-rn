/// <reference types="jest" />
import { isFromBlockedUser } from '../moderation'

const message = (userId?: string) => ({
  id: 'm1',
  user: userId ? { id: userId } : null,
})

describe('isFromBlockedUser', () => {
  test('hides a message by someone the viewer has blocked', () => {
    expect(isFromBlockedUser(['u2', 'u3'], message('u3'))).toBe(true)
  })

  test('shows everyone else', () => {
    expect(isFromBlockedUser(['u2'], message('u1'))).toBe(false)
  })

  test('shows everything when nobody is blocked', () => {
    expect(isFromBlockedUser([], message('u1'))).toBe(false)
  })

  test('shows a message without an author', () => {
    expect(isFromBlockedUser(['u2'], message())).toBe(false)
  })
})
