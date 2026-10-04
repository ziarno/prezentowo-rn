import type { UserSearchResult } from '@prezentowo/types'
import assert from 'assert'
import { Accounts } from 'meteor/accounts-base'
import { DDP } from 'meteor/ddp'
import { Meteor } from 'meteor/meteor'

import { createFamilyEvent, createUser } from '../../../tests/fixtures'
import {
  callAsUser,
  createLoginToken,
  rejectsWithReason,
  resetDatabase,
  subscribeAsUser,
} from '../../../tests/helpers'
import '../accounts/accounts.methods'
import '../gifts/gifts.publications'
import { createUserIndexes } from './users.indexes'
import './users.search'

const tokensOf = async (userId: string) =>
  (
    (await Meteor.users.findOneAsync(userId)) as
      | (Meteor.User & { nameTokens?: string[] })
      | undefined
  )?.nameTokens

describe('nameTokens', function () {
  beforeEach(async function () {
    await resetDatabase()
  })

  it('folds a new user’s name: lower case, no diacritics, ł → l, split on spaces and hyphens', async function () {
    const userId = await createUser('Łucja Żółć-Nowak')

    assert.deepStrictEqual(await tokensOf(userId), ['lucja', 'zolc', 'nowak'])
  })

  it('is written on registration', async function () {
    const { id } = await callAsUser<{ id: string }>(null, 'registerNewUser', {
      email: 'ewa@example.com',
      password: 'secret123',
      name: 'Ewa Świątek',
    })

    assert.deepStrictEqual(await tokensOf(id), ['ewa', 'swiatek'])
  })

  it('is rewritten with the name', async function () {
    const userId = await Accounts.createUserAsync({ email: 'a@example.com' })
    assert.strictEqual(await tokensOf(userId), undefined)

    await callAsUser(userId, 'updateUser', { name: 'Gośka Kąkol' })

    assert.deepStrictEqual(await tokensOf(userId), ['goska', 'kakol'])
  })

  it('has a multikey index', async function () {
    await createUserIndexes()

    const indexes = await Meteor.users.rawCollection().indexes()
    assert.ok(indexes.some(i => i.key.nameTokens === 1))
  })

  it('is never published with a profile', async function () {
    const family = await createFamilyEvent()

    const sub = await subscribeAsUser(
      family.users.bartek,
      'users.inEvent',
      family.eventId,
    )
    sub.stop()

    assert.ok(sub.messages.length > 0)
    assert.ok(!JSON.stringify(sub.messages).includes('nameTokens'))
  })
})

describe('users.search', function () {
  let caller: string

  beforeEach(async function () {
    await resetDatabase()
    caller = await createUser('Caller')
  })

  const search = (query: string, as: string | null = caller) =>
    callAsUser<UserSearchResult[]>(as, 'users.search', { query })

  const namesFor = async (query: string) =>
    (await search(query)).map(r => r.name)

  it('matches the start of any word of a name, ignoring case and diacritics', async function () {
    await createUser('Łukasz Żółć')
    await createUser('Anna-Maria Kowalska')
    await createUser('Bartek')

    assert.deepStrictEqual(await namesFor('łuk'), ['Łukasz Żółć'])
    assert.deepStrictEqual(await namesFor('LUK'), ['Łukasz Żółć'])
    assert.deepStrictEqual(await namesFor('zol'), ['Łukasz Żółć'])
    assert.deepStrictEqual(await namesFor('mar'), ['Anna-Maria Kowalska'])
    assert.deepStrictEqual(await namesFor('kowal'), ['Anna-Maria Kowalska'])
    assert.deepStrictEqual(await namesFor('ukasz'), [])
  })

  it('needs every query word to match', async function () {
    await createUser('Anna Kowalska')
    await createUser('Anna Nowak')

    assert.deepStrictEqual(await namesFor('anna kow'), ['Anna Kowalska'])
    assert.deepStrictEqual(await namesFor('ann now'), ['Anna Nowak'])
    assert.deepStrictEqual(await namesFor('anna zol'), [])
  })

  it('searches nothing under 3 folded characters', async function () {
    await createUser('Al Bo')

    assert.deepStrictEqual(await namesFor('Ł'), [])
    assert.deepStrictEqual(await namesFor('al'), [])
    assert.deepStrictEqual(await namesFor(' a - b '), [])
    assert.deepStrictEqual(await namesFor('al b'), ['Al Bo'])
  })

  it('treats regex characters literally', async function () {
    await createUser('Abcd')

    assert.deepStrictEqual(await namesFor('a.c'), [])
    assert.deepStrictEqual(await namesFor('ab.*'), [])
  })

  it('leaves out the caller and users without a name', async function () {
    await createUser('Callum')
    const nameless = await Accounts.createUserAsync({
      email: 'nameless@example.com',
    })
    // Tokens without a name can't come from our writes; check it anyway.
    await Meteor.users.updateAsync(nameless, {
      $set: { nameTokens: ['callisto'] },
    })

    assert.deepStrictEqual(await namesFor('cal'), ['Callum'])
  })

  it('returns at most 10, ordered by name, and only name and avatar', async function () {
    const ids: Record<string, string> = {}
    for (const n of [12, 3, 7, 1, 10, 5, 11, 2, 9, 4, 8, 6]) {
      const name = `Zosia ${String(n).padStart(2, '0')}`
      ids[name] = await createUser(name)
    }
    await Meteor.users.updateAsync(ids['Zosia 01']!, {
      $set: { 'profile.avatar': 'f2' },
    })

    const results = await search('zosia')

    assert.deepStrictEqual(
      results.map(r => r.name),
      Array.from(
        { length: 10 },
        (_, i) => `Zosia ${String(i + 1).padStart(2, '0')}`,
      ),
    )
    assert.deepStrictEqual(results[0], {
      userId: ids['Zosia 01'],
      name: 'Zosia 01',
      avatar: 'f2',
    })
    assert.deepStrictEqual(results[1], {
      userId: ids['Zosia 02'],
      name: 'Zosia 02',
    })
  })

  it('requires a signed-in caller', async function () {
    await rejectsWithReason(search('zosia', null), 'mustBeLoggedIn')
  })

  it('rejects a query longer than any name', async function () {
    await assert.rejects(search('a '.repeat(51)))
    await search('a'.repeat(100))
  })

  describe('rate limit', function () {
    type Client = {
      callAsync: (name: string, ...args: unknown[]) => Promise<unknown>
      disconnect: () => void
    }
    const clients: Client[] = []

    afterEach(function () {
      clients.splice(0).forEach(c => c.disconnect())
    })

    const connectAs = async (userId: string) => {
      const client = DDP.connect(Meteor.absoluteUrl()) as unknown as Client
      clients.push(client)
      await client.callAsync('login', {
        resume: await createLoginToken(userId),
      })
      return client
    }

    const searchOver = (client: Client) =>
      client.callAsync('users.search', { query: 'zosia' })

    it('allows 10 calls per 10 s per user and connection', async function () {
      const first = await connectAs(caller)

      for (let i = 0; i < 10; i++) await searchOver(first)
      await assert.rejects(searchOver(first), (e: Meteor.Error) => {
        assert.strictEqual(e.error, 'too-many-requests')
        return true
      })

      // Another connection has its own allowance.
      const second = await connectAs(caller)
      await searchOver(second)
    })
  })
})
