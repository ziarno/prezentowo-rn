/// <reference types="jest" />
import { unconfirmedToggles } from '../pushPreferences'

describe('unconfirmedToggles', () => {
  it('keeps a toggle the user document doesn’t show yet', () => {
    const toggled = { chat: false }
    expect(unconfirmedToggles(toggled, { chat: true })).toEqual({ chat: false })
    expect(unconfirmedToggles(toggled, undefined)).toEqual({ chat: false })
  })

  it('drops a toggle once the user document shows it', () => {
    expect(
      unconfirmedToggles({ chat: false, invited: false }, { chat: false }),
    ).toEqual({ invited: false })
  })

  it('counts a missing kind as on', () => {
    expect(unconfirmedToggles({ invited: true }, {})).toEqual({})
  })

  it('returns the same object when nothing changed, so state doesn’t churn', () => {
    const toggled = { chat: false }
    expect(unconfirmedToggles(toggled, {})).toBe(toggled)
  })
})
