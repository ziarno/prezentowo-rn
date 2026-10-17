import { Accounts } from 'meteor/accounts-base'
import { Meteor } from 'meteor/meteor'

// Creates the dev user with its `nameTokens`.
import '../users/users.nameTokens'

// A fixed account for one-tap sign-in while developing. The handler is only
// ever registered in development; see registerDevLogin.
export const DEV_LOGIN_EMAIL = 'dev@prezentowo.local'
export const DEV_LOGIN_NAME = 'Dev'
// A fixed adult date, so the dev user is searchable and gets push.
export const DEV_LOGIN_BIRTH_DATE = '1990-01-01'

type DevLoginOptions = { devLogin?: unknown }

async function findOrCreateDevUser() {
  const existing = await Accounts.findUserByEmail(DEV_LOGIN_EMAIL)
  if (existing) {
    // A dev user from before the date question gets its date now.
    if (!existing.birthDate) {
      await Meteor.users.updateAsync(existing._id, {
        $set: { birthDate: DEV_LOGIN_BIRTH_DATE },
      })
    }
    return existing._id
  }

  // The name and birth date are set up front so the app skips first-login.
  const userId = await Accounts.createUserAsync({
    email: DEV_LOGIN_EMAIL,
    profile: { name: DEV_LOGIN_NAME },
  })
  await Meteor.users.updateAsync(userId, {
    $set: { birthDate: DEV_LOGIN_BIRTH_DATE },
  })
  return userId
}

async function devLoginHandler(options: DevLoginOptions) {
  if (options.devLogin !== true) return undefined
  return { userId: await findOrCreateDevUser() }
}

/**
 * Registers the `{ devLogin: true }` login handler when `isDevelopment` is
 * set, and does nothing otherwise. Takes the flag as an argument so tests can
 * prove the production path registers nothing.
 */
export function registerDevLogin(isDevelopment: boolean) {
  if (!isDevelopment) return
  // accounts-base (3.3.1, _runLoginHandlers) awaits handlers; @types/meteor
  // still types them as sync.
  Accounts.registerLoginHandler(
    'devLogin',
    devLoginHandler as unknown as (options: DevLoginOptions) => undefined,
  )
}
