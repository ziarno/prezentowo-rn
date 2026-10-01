/// <reference types="jest" />
import { claimInstallReferrerInvite } from '../installReferrer'
import { takePendingInvite } from '../pendingInvite'

// Fakes of SecureStore (an in-memory store), the Play Install Referrer and
// the platform.
const mockStore = new Map<string, string>()
const mockDevice = {
  os: 'android' as 'android' | 'ios',
  referrer: (): Promise<string> =>
    Promise.resolve('utm_source=google-play&utm_medium=organic'),
  reads: 0,
}

jest.mock('expo-secure-store', () => ({
  getItemAsync: async (key: string) => mockStore.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => {
    mockStore.set(key, value)
  },
  deleteItemAsync: async (key: string) => {
    mockStore.delete(key)
  },
}))

jest.mock('expo-application', () => ({
  getInstallReferrerAsync: () => {
    mockDevice.reads++
    return mockDevice.referrer()
  },
}))

jest.mock('react-native', () => ({
  Platform: {
    get OS() {
      return mockDevice.os
    },
  },
}))

const installedWith = (referrer: string) => {
  mockDevice.referrer = () => Promise.resolve(referrer)
}

beforeEach(() => {
  mockStore.clear()
  mockDevice.os = 'android'
  mockDevice.reads = 0
  installedWith('utm_source=google-play&utm_medium=organic')
})

describe('claimInstallReferrerInvite', () => {
  it('turns a Play install referrer’s code into the pending invite', async () => {
    installedWith('code=Ab3x')

    await claimInstallReferrerInvite()

    expect(await takePendingInvite()).toEqual({ code: 'Ab3x' })
  })

  it('finds the code among other referrer parameters', async () => {
    installedWith('utm_source=whatsapp&code=Ab3x&utm_medium=share')

    await claimInstallReferrerInvite()

    expect(await takePendingInvite()).toEqual({ code: 'Ab3x' })
  })

  it('reads a referrer that arrives still percent-encoded', async () => {
    installedWith('code%3DAb3x')

    await claimInstallReferrerInvite()

    expect(await takePendingInvite()).toEqual({ code: 'Ab3x' })
  })

  it('leaves no pending invite after an install without a code', async () => {
    await claimInstallReferrerInvite()

    expect(await takePendingInvite()).toBeNull()
  })

  it('ignores an empty code', async () => {
    installedWith('code=')

    await claimInstallReferrerInvite()

    expect(await takePendingInvite()).toBeNull()
  })

  it('ignores a code that isn’t one', async () => {
    installedWith('code=..%2F')

    await claimInstallReferrerInvite()

    expect(await takePendingInvite()).toBeNull()
  })

  it('reads the referrer only once per install', async () => {
    installedWith('code=Ab3x')

    await claimInstallReferrerInvite()
    expect(await takePendingInvite()).toEqual({ code: 'Ab3x' })

    // The invite was joined; a later launch mustn't bring it back.
    await claimInstallReferrerInvite()
    expect(await takePendingInvite()).toBeNull()
    expect(mockDevice.reads).toBe(1)
  })

  it('keeps a pending invite a signed-out 7a already left', async () => {
    installedWith('code=Ab3x')
    mockStore.set(
      'prezentowo.pendingInvite',
      JSON.stringify({ code: 'Zz9y', participantId: 'p1' }),
    )

    await claimInstallReferrerInvite()

    expect(await takePendingInvite()).toEqual({
      code: 'Zz9y',
      participantId: 'p1',
    })
  })

  it('gives up quietly when the referrer can’t be read', async () => {
    mockDevice.referrer = () => Promise.reject(new Error('Play unavailable'))

    await expect(claimInstallReferrerInvite()).resolves.toBeUndefined()
    expect(await takePendingInvite()).toBeNull()
  })

  it('asks again next time when the referrer couldn’t be read', async () => {
    mockDevice.referrer = () => Promise.reject(new Error('Play unavailable'))
    await claimInstallReferrerInvite()

    installedWith('code=Ab3x')
    await claimInstallReferrerInvite()

    expect(await takePendingInvite()).toEqual({ code: 'Ab3x' })
  })

  it('never asks on iOS, which has no install referrer', async () => {
    mockDevice.os = 'ios'
    installedWith('code=Ab3x')

    await claimInstallReferrerInvite()

    expect(mockDevice.reads).toBe(0)
    expect(await takePendingInvite()).toBeNull()
  })
})
