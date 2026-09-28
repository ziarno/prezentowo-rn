import assert from 'assert'
import { Accounts } from 'meteor/accounts-base'
import { Meteor } from 'meteor/meteor'

import '../imports/api/accounts/accounts.methods'
import { Events } from '../imports/api/events/events.collection'
import { callAsUser, resetDatabase } from './helpers'

describe('test helpers', function () {
  beforeEach(async function () {
    await resetDatabase()
  })

  describe('resetDatabase', function () {
    it('empties every collection', async function () {
      await Accounts.createUserAsync({ email: 'a@example.com' })
      await Events.insertAsync({ title: 'Wigilia' } as never)

      await resetDatabase()

      assert.strictEqual(await Meteor.users.find().countAsync(), 0)
      assert.strictEqual(await Events.find().countAsync(), 0)
    })
  })

  describe('callAsUser', function () {
    it('runs the method with this.userId set', async function () {
      const userId = await Accounts.createUserAsync({ email: 'a@example.com' })

      await callAsUser(userId, 'updateUser', { name: 'Ala' })

      const user = await Meteor.users.findOneAsync(userId)
      assert.strictEqual(user?.profile?.name, 'Ala')
    })

    it('runs the method signed out with null', async function () {
      await assert.rejects(callAsUser(null, 'updateUser', { name: 'Ala' }), {
        error: 'notAuthorized',
      })
    })

    it('throws for an unknown method', async function () {
      await assert.rejects(
        callAsUser(null, 'no.such.method'),
        /no\.such\.method/,
      )
    })
  })
})
