import assert from 'assert'
import { Accounts } from 'meteor/accounts-base'
import { DDP } from 'meteor/ddp'
import { Meteor } from 'meteor/meteor'

import { resetDatabase } from '../../../tests/helpers'
import { DEV_LOGIN_EMAIL, DEV_LOGIN_NAME, registerDevLogin } from './devLogin'

type LoginHandler = { name: string | null }
type LoginResult = { id: string; token: string }

// accounts-base keeps its handlers here; @types/meteor doesn't declare it.
const loginHandlers = () =>
  (Accounts as unknown as { _loginHandlers: LoginHandler[] })._loginHandlers

const devLoginHandlerCount = () =>
  loginHandlers().filter(h => h.name === 'devLogin').length

// Log in the way the mobile app does: a real DDP client calling `login`.
async function loginOverDdp(options: Record<string, unknown>) {
  const client = DDP.connect(Meteor.absoluteUrl()) as unknown as {
    callAsync: (name: string, ...args: unknown[]) => Promise<LoginResult>
    disconnect: () => void
  }
  try {
    return await client.callAsync('login', options)
  } finally {
    client.disconnect()
  }
}

describe('dev login', function () {
  let savedHandlers: LoginHandler[]

  beforeEach(async function () {
    await resetDatabase()
    // Each test decides for itself whether the handler is registered.
    savedHandlers = [...loginHandlers()]
    const others = savedHandlers.filter(h => h.name !== 'devLogin')
    loginHandlers().splice(0, loginHandlers().length, ...others)
  })

  afterEach(function () {
    loginHandlers().splice(0, loginHandlers().length, ...savedHandlers)
  })

  describe('outside development', function () {
    it('registers no handler', function () {
      registerDevLogin(false)
      assert.strictEqual(devLoginHandlerCount(), 0)
    })

    it('rejects a { devLogin: true } login', async function () {
      registerDevLogin(false)
      await assert.rejects(loginOverDdp({ devLogin: true }))
      assert.strictEqual(await Meteor.users.find().countAsync(), 0)
    })
  })

  describe('in development', function () {
    beforeEach(function () {
      registerDevLogin(true)
    })

    it('registers exactly one handler', function () {
      assert.strictEqual(devLoginHandlerCount(), 1)
    })

    it('creates the dev user with a first name on first use', async function () {
      const { id, token } = await loginOverDdp({ devLogin: true })

      assert.ok(token)
      const user = await Meteor.users.findOneAsync(id)
      assert.strictEqual(user?.emails?.[0]?.address, DEV_LOGIN_EMAIL)
      assert.strictEqual(user?.profile?.name, DEV_LOGIN_NAME)
      assert.deepStrictEqual(
        (user as { nameTokens?: string[] } | undefined)?.nameTokens,
        [DEV_LOGIN_NAME.toLowerCase()],
      )
    })

    it('logs in as the same user every time', async function () {
      const first = await loginOverDdp({ devLogin: true })
      const second = await loginOverDdp({ devLogin: true })

      assert.strictEqual(second.id, first.id)
      assert.strictEqual(await Meteor.users.find().countAsync(), 1)
    })

    it('leaves other login requests to other handlers', async function () {
      await assert.rejects(loginOverDdp({ devLogin: false }))
      await assert.rejects(loginOverDdp({ devLogin: 'true' }))
      assert.strictEqual(await Meteor.users.find().countAsync(), 0)
    })
  })
})
