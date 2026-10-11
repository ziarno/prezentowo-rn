/// <reference types="jest" />
import { NetworkError } from '@/sync/errors'

import { type PushDeviceDeps, createPushDevice } from '../registration'

type Call = { method: string; args: unknown }

// A fake phone and server: OS permission, the tokens, SecureStore and the
// method calls that reach the server.
function setup(store = new Map<string, string>()) {
  const phone = {
    granted: true,
    expoToken: 'ExponentPushToken[1]',
    locale: 'pl' as 'en' | 'pl',
    store,
  }
  const calls: Call[] = []
  const server = { reachable: true, rejects: false }

  const reach = async (method: string, args: unknown) => {
    if (!server.reachable) throw new NetworkError('timeout', method)
    if (server.rejects) throw new Error('serverError')
    calls.push({ method, args })
  }

  const deps: PushDeviceDeps = {
    permissionGranted: async () => phone.granted,
    device: async () => ({
      expoToken: phone.expoToken,
      deviceToken: 'apns-1',
      platform: 'ios',
      apnsEnvironment: 'development',
    }),
    locale: () => phone.locale,
    register: args => reach('push.register', args),
    unregister: expoToken => reach('push.unregister', { expoToken }),
    store: {
      get: async key => phone.store.get(key) ?? null,
      set: async (key, value) => void phone.store.set(key, value),
      remove: async key => void phone.store.delete(key),
    },
  }
  const device = createPushDevice(deps)
  const methods = () => calls.map(c => c.method)
  return { phone, calls, server, device, methods }
}

const registered = (expoToken = 'ExponentPushToken[1]', locale = 'pl') => ({
  method: 'push.register',
  args: {
    expoToken,
    deviceToken: 'apns-1',
    platform: 'ios',
    apnsEnvironment: 'development',
    locale,
  },
})

const unregistered = (expoToken = 'ExponentPushToken[1]') => ({
  method: 'push.unregister',
  args: { expoToken },
})

describe('createPushDevice', () => {
  describe('registering', () => {
    it('registers on start once signed in and connected', async () => {
      const { device, calls } = setup()
      device.setSession({ signedIn: true, online: true })
      await device.idle()
      expect(calls).toEqual([registered()])
    })

    it('registers nothing without permission', async () => {
      const { phone, device, calls } = setup()
      phone.granted = false
      device.setSession({ signedIn: true, online: true })
      await device.idle()
      expect(calls).toEqual([])
    })

    it('registers nothing while signed out', async () => {
      const { device, calls } = setup()
      device.setSession({ signedIn: false, online: true })
      device.register()
      await device.idle()
      expect(calls).toEqual([])
    })

    it('waits offline for the connection', async () => {
      const { device, calls } = setup()
      device.setSession({ signedIn: true, online: false })
      await device.idle()
      expect(calls).toEqual([])

      device.setSession({ signedIn: true, online: true })
      await device.idle()
      expect(calls).toEqual([registered()])
    })

    it('registers once per start, not on every reconnect', async () => {
      const { device, calls } = setup()
      device.setSession({ signedIn: true, online: true })
      await device.idle()
      device.setSession({ signedIn: true, online: false })
      device.setSession({ signedIn: true, online: true })
      await device.idle()
      expect(calls).toEqual([registered()])
    })

    it('registers again when asked: after a grant, a new token or a language change', async () => {
      const { phone, device, calls } = setup()
      device.setSession({ signedIn: true, online: true })
      await device.idle()

      phone.locale = 'en'
      device.register()
      await device.idle()

      expect(calls).toEqual([registered(), registered(undefined, 'en')])
    })

    it('registers after a sign-in', async () => {
      const { device, calls } = setup()
      device.setSession({ signedIn: false, online: true })
      device.setSession({ signedIn: true, online: true })
      await device.idle()
      expect(calls).toEqual([registered()])
    })

    it('tries a failed registration again on the next connection', async () => {
      const { server, device, calls } = setup()
      server.reachable = false
      device.setSession({ signedIn: true, online: true })
      await device.idle()
      expect(calls).toEqual([])

      server.reachable = true
      device.setSession({ signedIn: true, online: false })
      device.setSession({ signedIn: true, online: true })
      await device.idle()
      expect(calls).toEqual([registered()])
    })
  })

  describe('signing out', () => {
    it('unregisters this device', async () => {
      const { device, calls } = setup()
      device.setSession({ signedIn: true, online: true })
      await device.idle()

      await device.signOut()

      expect(calls).toEqual([registered(), unregistered()])
    })

    it('unregisters a device registered on an earlier start', async () => {
      const first = setup()
      first.device.setSession({ signedIn: true, online: true })
      await first.device.idle()

      // The next start, on the same phone, signs out offline before its own
      // registration could run.
      const { device, calls } = setup(first.phone.store)
      device.setSession({ signedIn: true, online: false })
      await device.signOut()
      device.setSession({ signedIn: false, online: true })
      await device.idle()

      expect(calls).toEqual([unregistered()])
    })

    it('does nothing for a device that never registered', async () => {
      const { phone, device, calls } = setup()
      phone.granted = false
      device.setSession({ signedIn: true, online: true })
      await device.idle()

      await device.signOut()

      expect(calls).toEqual([])
    })

    it('keeps the token offline and sends it on the next connection, signed out', async () => {
      const { device, calls, methods } = setup()
      device.setSession({ signedIn: true, online: true })
      await device.idle()
      device.setSession({ signedIn: true, online: false })

      await device.signOut()
      device.setSession({ signedIn: false, online: false })
      expect(methods()).toEqual(['push.register'])

      device.setSession({ signedIn: false, online: true })
      await device.idle()
      expect(calls).toEqual([registered(), unregistered()])

      // Sent once.
      device.setSession({ signedIn: false, online: false })
      device.setSession({ signedIn: false, online: true })
      await device.idle()
      expect(methods()).toEqual(['push.register', 'push.unregister'])
    })

    it('keeps the token when the unregister fails, and never fails the sign-out', async () => {
      const { server, device, calls } = setup()
      device.setSession({ signedIn: true, online: true })
      await device.idle()

      server.reachable = false
      await expect(device.signOut()).resolves.toBeUndefined()
      device.setSession({ signedIn: false, online: true })
      await device.idle()

      server.reachable = true
      device.setSession({ signedIn: false, online: false })
      device.setSession({ signedIn: false, online: true })
      await device.idle()
      expect(calls).toEqual([registered(), unregistered()])
    })

    it('sends a kept token before the next account registers', async () => {
      const { phone, device, calls } = setup()
      device.setSession({ signedIn: true, online: true })
      await device.idle()
      device.setSession({ signedIn: true, online: false })
      await device.signOut()

      // Someone else signs in on this phone, still offline, then connects.
      phone.locale = 'en'
      device.setSession({ signedIn: false, online: false })
      device.setSession({ signedIn: true, online: false })
      device.setSession({ signedIn: true, online: true })
      await device.idle()

      expect(calls).toEqual([
        registered(),
        unregistered(),
        registered(undefined, 'en'),
      ])
    })

    it('ignores a registration asked for while signing out', async () => {
      const { device, calls } = setup()
      device.setSession({ signedIn: true, online: true })
      await device.idle()

      const signingOut = device.signOut()
      // A language change lands while the logout is still on its way.
      device.register()
      await signingOut
      await device.idle()

      expect(calls).toEqual([registered(), unregistered()])
    })

    it('registers again after signing back in', async () => {
      const { device, calls } = setup()
      device.setSession({ signedIn: true, online: true })
      await device.idle()
      await device.signOut()
      device.setSession({ signedIn: false, online: true })

      device.setSession({ signedIn: true, online: true })
      await device.idle()

      expect(calls).toEqual([registered(), unregistered(), registered()])
    })

    it('unregisters a device whose registration may have landed unanswered', async () => {
      const { server, device, calls } = setup()
      // The server took it, but the answer never came back.
      server.reachable = false
      device.setSession({ signedIn: true, online: true })
      await device.idle()

      server.reachable = true
      await device.signOut()

      expect(calls).toEqual([unregistered()])
    })

    it('drops a registration still waiting for the connection', async () => {
      const { device, calls } = setup()
      device.setSession({ signedIn: true, online: false })
      await device.signOut()
      device.setSession({ signedIn: false, online: true })
      await device.idle()
      expect(calls).toEqual([])
    })
  })

  describe('forgetting', () => {
    it('forgets the device without a call, once the account is gone', async () => {
      const { device, calls } = setup()
      device.setSession({ signedIn: true, online: true })
      await device.idle()

      await device.forget()
      await device.signOut()

      expect(calls).toEqual([registered()])
    })
  })
})
