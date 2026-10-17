/// <reference types="jest" />
import type { PushPermission } from '../permission'
import { createPushPrePrompt } from '../prePrompt'

// A fake phone: SecureStore, kept across app runs, and the OS permission.
function setup(store = new Map<string, string>()) {
  const phone = {
    permission: 'undetermined' as PushPermission,
    sixteenPlus: true,
    store,
  }
  const prePrompt = createPushPrePrompt({
    sixteenPlus: () => phone.sixteenPlus,
    permission: async () => phone.permission,
    store: {
      get: async key => phone.store.get(key) ?? null,
      set: async (key, value) => void phone.store.set(key, value),
    },
  })
  return { phone, prePrompt }
}

describe('createPushPrePrompt', () => {
  it('opens after the first event when the OS hasn’t asked yet', async () => {
    const { prePrompt } = setup()
    expect(prePrompt.isOpen()).toBe(false)
    await prePrompt.offer()
    expect(prePrompt.isOpen()).toBe(true)
  })

  it('tells subscribers when it opens and closes', async () => {
    const { prePrompt } = setup()
    const seen: boolean[] = []
    prePrompt.subscribe(() => seen.push(prePrompt.isOpen()))
    await prePrompt.offer()
    prePrompt.close()
    expect(seen).toEqual([true, false])
  })

  it('never opens again by itself once shown', async () => {
    const { prePrompt } = setup()
    await prePrompt.offer()
    prePrompt.close()
    await prePrompt.offer()
    expect(prePrompt.isOpen()).toBe(false)
  })

  it('remembers it was shown on the next app run', async () => {
    const store = new Map<string, string>()
    const first = setup(store)
    await first.prePrompt.offer()

    const next = setup(store)
    await next.prePrompt.offer()
    expect(next.prePrompt.isOpen()).toBe(false)
  })

  it('stays shut when the OS already has an answer', async () => {
    for (const permission of ['granted', 'denied'] as const) {
      const { phone, prePrompt } = setup()
      phone.permission = permission
      await prePrompt.offer()
      expect(prePrompt.isOpen()).toBe(false)
    }
  })

  it('never opens for a user under 16, or one who has not answered the age question', async () => {
    const { phone, prePrompt } = setup()
    phone.sixteenPlus = false
    await prePrompt.offer()
    expect(prePrompt.isOpen()).toBe(false)
  })

  it('opens once for two events in a row', async () => {
    const { prePrompt } = setup()
    const seen: boolean[] = []
    prePrompt.subscribe(() => seen.push(prePrompt.isOpen()))
    await Promise.all([prePrompt.offer(), prePrompt.offer()])
    expect(seen).toEqual([true])
  })
})
