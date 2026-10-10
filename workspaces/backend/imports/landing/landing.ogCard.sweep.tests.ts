import assert from 'assert'
import { mkdtemp, readdir, rm, writeFile } from 'fs/promises'
import { Meteor } from 'meteor/meteor'
import { tmpdir } from 'os'
import { join } from 'path'

import { createFamilyEvent } from '../../tests/fixtures'
import { callAsUser, resetDatabase } from '../../tests/helpers'
import { rotateInvite } from '../api/invites/invites.codes'
import { Invites, createInviteIndexes } from '../api/invites/invites.collection'
import { sweepStaleOgCards } from './landing.ogCard.sweep'
import './landing.routes'

const render = (path: string) =>
  fetch(Meteor.absoluteUrl(path.replace(/^\//, ''))).then(res =>
    res.arrayBuffer(),
  )

describe('sweepStaleOgCards', function () {
  // Rendering fonts as paths takes a moment on a cold start.
  this.timeout(20_000)

  let family: Awaited<ReturnType<typeof createFamilyEvent>>
  let code: string
  let savedDir: unknown
  let dir: string

  const cards = () => readdir(dir).then(files => files.sort())

  before(async function () {
    await createInviteIndexes()
    savedDir = Meteor.settings.ogCardsDir
  })

  after(function () {
    Meteor.settings.ogCardsDir = savedDir
  })

  beforeEach(async function () {
    await resetDatabase()
    dir = join(await mkdtemp(join(tmpdir(), 'og-')), '.og-cards')
    Meteor.settings.ogCardsDir = dir
    family = await createFamilyEvent()
    code = (await Invites.findOneAsync({ eventId: family.eventId }))!.code
  })

  afterEach(async function () {
    await rm(join(dir, '..'), { recursive: true, force: true })
  })

  it('does nothing when no card was ever rendered', async function () {
    await sweepStaleOgCards()
  })

  it('removes the card of a title that changed, and keeps the current one', async function () {
    await render(`/e/${code}/og.png`)
    const [old] = await cards()
    await callAsUser(family.users.ola, 'events.update', {
      eventId: family.eventId,
      title: 'Wigilia u babci',
    })
    await render(`/e/${code}/og.png`)
    assert.strictEqual((await cards()).length, 2)

    await sweepStaleOgCards()

    const left = await cards()
    assert.strictEqual(left.length, 1)
    assert.notStrictEqual(left[0], old)
  })

  it('removes the card of a rotated code, and keeps the new code’s', async function () {
    await render(`/e/${code}/og.png`)
    const [old] = await cards()
    const fresh = await rotateInvite(family.eventId)
    await render(`/e/${fresh}/og.png`)

    await sweepStaleOgCards()

    const left = await cards()
    assert.strictEqual(left.length, 1)
    assert.notStrictEqual(left[0], old)
  })

  it('removes the card of a deleted event', async function () {
    await render(`/e/${code}/og.png`)
    await callAsUser(family.users.ola, 'events.delete', {
      eventId: family.eventId,
    })

    await sweepStaleOgCards()

    assert.deepStrictEqual(await cards(), [])
  })

  it('keeps the brand card', async function () {
    await render('/og.png')
    await render(`/e/${code}/og.png`)

    await sweepStaleOgCards()

    assert.strictEqual((await cards()).length, 2)
    assert.ok((await cards()).some(file => file.startsWith('brand-')))
  })

  it('leaves a card still being written alone', async function () {
    await render(`/e/${code}/og.png`)
    const inFlight = 'abc.png.xyz.tmp'
    await writeFile(join(dir, inFlight), 'partial')

    await sweepStaleOgCards()

    assert.ok((await cards()).includes(inFlight))
  })
})
