import type { AppLanguage, RegisterPushArgs } from '@prezentowo/types'

// SecureStore keys. The Expo token this device last registered, for the
// sign-out's `push.unregister`; and one a sign-out couldn't send yet.
export const REGISTERED_KEY = 'prezentowo.pushToken'
export const UNSENT_UNREGISTER_KEY = 'prezentowo.pushUnregister'

export type PushDeviceDeps = {
  // Whether the OS delivers pushes to this app. Never asks.
  permissionGranted: () => Promise<boolean>
  // This device's tokens and platform.
  device: () => Promise<Omit<RegisterPushArgs, 'locale'>>
  locale: () => AppLanguage
  // `push.register` / `push.unregister` on the server.
  register: (args: RegisterPushArgs) => Promise<void>
  unregister: (expoToken: string) => Promise<void>
  store: {
    get: (key: string) => Promise<string | null>
    set: (key: string, value: string) => Promise<void>
    remove: (key: string) => Promise<void>
  }
}

// `sixteenPlus`: the user is in the 16+ band. Push is only for them, so
// nothing registers for the 13-15 band, or while the age is unanswered or
// not loaded yet (docs/spec.md §10.5).
export type PushSession = {
  signedIn: boolean
  online: boolean
  sixteenPlus: boolean
}

/**
 * This device's place in the server's push registry (docs/spec.md §10.5).
 * While signed in as a 16+ user with permission granted it calls `push.register` on each
 * start and sign-in, and whenever `register()` asks (a grant, a new token, a
 * language change); offline, it waits for the connection, and a failed one
 * is tried again on the next. Signing out unregisters the device; a token
 * that can't be sent then waits in SecureStore and goes on the next
 * connection, signed in or not, before any registration. Nothing registers
 * from the sign-out until the next sign-in. One step runs at a time.
 */
export function createPushDevice({
  permissionGranted,
  device,
  locale,
  register,
  unregister,
  store,
}: PushDeviceDeps) {
  let session: PushSession = {
    signedIn: false,
    online: false,
    sixteenPlus: false,
  }
  // A registration is due.
  let wanted = false
  // Signed out on this device, though the session may not have ended yet.
  let leaving = false
  let queue: Promise<void> = Promise.resolve()

  const run = (step: () => Promise<void>) => {
    queue = queue.then(step).catch(() => {})
    return queue
  }

  const sendUnsentUnregister = async (): Promise<boolean> => {
    const expoToken = await store.get(UNSENT_UNREGISTER_KEY)
    if (!expoToken) return true
    try {
      await unregister(expoToken)
    } catch {
      return false
    }
    await store.remove(UNSENT_UNREGISTER_KEY)
    return true
  }

  const flush = async () => {
    if (!session.online) return
    if (!(await sendUnsentUnregister())) return
    if (!session.signedIn || leaving || !wanted) return
    // A registration stays due until the band is known to be 16+.
    if (!session.sixteenPlus) return
    wanted = false
    if (!(await permissionGranted())) return
    try {
      const args = await device()
      // Kept first: a registration that lands unanswered still needs its
      // unregister. Unregistering a token the server never got is a no-op.
      await store.set(REGISTERED_KEY, args.expoToken)
      await register({ ...args, locale: locale() })
    } catch {
      // The next connection tries again.
      wanted = true
    }
  }

  return {
    setSession(next: PushSession) {
      const previous = session
      session = next
      if (next.signedIn && !previous.signedIn) {
        wanted = true
        leaving = false
      }
      if (!next.signedIn) wanted = false
      const becameSixteenPlus = next.sixteenPlus && !previous.sixteenPlus
      if (becameSixteenPlus && next.signedIn) wanted = true
      if (next.online && !previous.online) void run(flush)
      else if (next.signedIn && !previous.signedIn) void run(flush)
      else if (becameSixteenPlus) void run(flush)
    },

    register() {
      if (!session.signedIn || leaving) return
      wanted = true
      void run(flush)
    },

    // Before the logout. Never rejects: a token it can't send is kept.
    signOut(): Promise<void> {
      leaving = true
      wanted = false
      return run(async () => {
        const expoToken = await store.get(REGISTERED_KEY)
        if (!expoToken) return
        await store.remove(REGISTERED_KEY)
        if (session.online) {
          try {
            await unregister(expoToken)
            return
          } catch {
            // Kept below.
          }
        }
        await store.set(UNSENT_UNREGISTER_KEY, expoToken)
      })
    },

    // After the account was deleted: the server dropped its devices already.
    forget(): Promise<void> {
      return run(async () => {
        wanted = false
        await store.remove(REGISTERED_KEY)
      })
    },

    // Settles once every step asked for so far has run.
    idle: () => run(async () => {}),
  }
}

export type PushDevice = ReturnType<typeof createPushDevice>
