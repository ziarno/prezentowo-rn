import assert from 'assert'
import { Meteor } from 'meteor/meteor'

import { createUser } from '../../../tests/fixtures'
import { resetDatabase } from '../../../tests/helpers'
import { unsetAgeBand } from './users.ageBand.migration'

describe('the startup migration off age bands', function () {
  beforeEach(resetDatabase)

  const withBand = async (name: string, band: string) => {
    const userId = await createUser(name)
    await Meteor.users
      .rawCollection()
      .updateOne({ _id: userId as never }, { $set: { ageBand: band } })
    return userId
  }
  const fieldsOf = async (userId: string) =>
    Object.keys((await Meteor.users.findOneAsync(userId)) ?? {})

  it('unsets the old band, so anyone who had one is asked for a date', async function () {
    const adult = await withBand('Ola', '16+')
    const teen = await withBand('Kasia', '13-15')

    await unsetAgeBand()

    for (const userId of [adult, teen]) {
      assert.ok(!(await fieldsOf(userId)).includes('ageBand'))
      assert.strictEqual(
        (await Meteor.users.findOneAsync(userId))?.birthDate,
        undefined,
      )
    }
  })

  it('leaves everything else alone, including a stored birth date', async function () {
    const ola = await createUser('Ola', '1990-05-04')
    await withBand('Kasia', '16+')

    await unsetAgeBand()

    const doc = await Meteor.users.findOneAsync(ola)
    assert.strictEqual(doc?.birthDate, '1990-05-04')
    assert.strictEqual(doc?.profile?.name, 'Ola')
  })

  it('can be run again', async function () {
    await withBand('Ola', '16+')

    await unsetAgeBand()
    await unsetAgeBand()

    assert.strictEqual(
      await Meteor.users
        .find({ ageBand: { $exists: true } } as never)
        .countAsync(),
      0,
    )
  })
})
