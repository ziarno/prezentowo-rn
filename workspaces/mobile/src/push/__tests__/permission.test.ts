/// <reference types="jest" />
import {
  type PushPermission,
  createPushPermission,
  pushSummary,
} from '../permission'

describe('pushSummary', () => {
  it('is on when every kind is on, missing ones included', () => {
    expect(pushSummary('granted', {}, true)).toBe('on')
    expect(pushSummary('granted', { invited: true, chat: true }, true)).toBe(
      'on',
    )
  })

  it('is some when only some kinds are on', () => {
    expect(pushSummary('granted', { chat: false }, true)).toBe('some')
  })

  it('is off when every kind is off', () => {
    expect(
      pushSummary(
        'granted',
        {
          invited: false,
          'participant-joined': false,
          'suggestion-claimed': false,
          'claimed-gift-removed': false,
          chat: false,
        },
        true,
      ),
    ).toBe('off')
  })

  it('is off in Settings whenever the OS isn’t delivering, whatever the toggles say', () => {
    expect(pushSummary('denied', {}, true)).toBe('offInSettings')
    expect(pushSummary('undetermined', { chat: false }, true)).toBe(
      'offInSettings',
    )
  })

  it('is for 16+ only for a user under 16, whatever the OS says', () => {
    expect(pushSummary('granted', {}, false)).toBe('sixteenPlus')
    expect(pushSummary('denied', {}, false)).toBe('sixteenPlus')
  })
})

// A fake OS: what it says now, and what the prompt answers.
function setup(initial: PushPermission = 'undetermined') {
  const os = { status: initial, answer: 'granted' as PushPermission }
  let granted = 0
  const permission = createPushPermission({
    read: async () => os.status,
    request: async () => {
      os.status = os.answer
      return os.status
    },
    onGranted: () => granted++,
  })
  return { os, permission, grants: () => granted }
}

describe('createPushPermission', () => {
  it('knows nothing until it reads the OS', async () => {
    const { permission } = setup('denied')
    expect(permission.get()).toBeNull()
    await permission.refresh()
    expect(permission.get()).toBe('denied')
  })

  it('tells subscribers when the status changes', async () => {
    const { os, permission } = setup('denied')
    const seen: (PushPermission | null)[] = []
    permission.subscribe(() => seen.push(permission.get()))
    await permission.refresh()
    await permission.refresh()
    os.status = 'granted'
    await permission.refresh()
    expect(seen).toEqual(['denied', 'granted'])
  })

  it('doesn’t register on the first read: the start already does', async () => {
    const { permission, grants } = setup('granted')
    await permission.refresh()
    expect(grants()).toBe(0)
  })

  it('registers when coming back from Settings with pushes allowed', async () => {
    const { os, permission, grants } = setup('denied')
    await permission.refresh()
    os.status = 'granted'
    await permission.refresh()
    await permission.refresh()
    expect(grants()).toBe(1)
  })

  it('registers after the OS prompt is allowed', async () => {
    const { permission, grants } = setup('undetermined')
    await permission.request()
    expect(permission.get()).toBe('granted')
    expect(grants()).toBe(1)
  })

  it('registers nothing after the OS prompt is refused', async () => {
    const { os, permission, grants } = setup('undetermined')
    os.answer = 'denied'
    await permission.request()
    expect(permission.get()).toBe('denied')
    expect(grants()).toBe(0)
  })

  it('registers once when a re-read lands while the prompt is answered', async () => {
    const { permission, grants } = setup('undetermined')
    await permission.refresh()
    // The prompt hands focus back to the app, which re-reads.
    await Promise.all([permission.request(), permission.refresh()])
    expect(permission.get()).toBe('granted')
    expect(grants()).toBe(1)
  })
})
