import assert from 'assert'
import { mkdtemp, readdir, rm, stat } from 'fs/promises'
import { Meteor } from 'meteor/meteor'
import { tmpdir } from 'os'
import { join } from 'path'
import sharp from 'sharp'

import { createFamilyEvent } from '../../tests/fixtures'
import { callAsUser, resetDatabase } from '../../tests/helpers'
import { rotateInvite } from '../api/invites/invites.codes'
import { Invites, createInviteIndexes } from '../api/invites/invites.collection'
import './landing.routes'

async function getPng(path: string) {
  const res = await fetch(Meteor.absoluteUrl(path.replace(/^\//, '')))
  const bytes = Buffer.from(await res.arrayBuffer())
  return { res, bytes }
}

describe('link-preview cards', function () {
  // Rendering fonts as paths takes a moment on a cold start.
  this.timeout(20_000)

  let family: Awaited<ReturnType<typeof createFamilyEvent>>
  let code: string
  let savedDir: unknown
  let dir: string

  const cards = () => readdir(dir).catch(() => [])

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

  it('renders the event’s card as a 1200 × 630 PNG', async function () {
    const { res, bytes } = await getPng(`/e/${code}/og.png`)

    assert.strictEqual(res.status, 200)
    assert.strictEqual(res.headers.get('content-type'), 'image/png')
    const { format, width, height } = await sharp(bytes).metadata()
    assert.deepStrictEqual(
      { format, width, height },
      {
        format: 'png',
        width: 1200,
        height: 630,
      },
    )
  })

  it('renders it once and serves it from the cache after that', async function () {
    const first = await getPng(`/e/${code}/og.png`)
    const [file] = await cards()
    const renderedAt = (await stat(join(dir, file))).mtimeMs

    const second = await getPng(`/e/${code}/og.png`)

    assert.deepStrictEqual(await cards(), [file])
    assert.strictEqual((await stat(join(dir, file))).mtimeMs, renderedAt)
    assert.ok(second.bytes.equals(first.bytes))
  })

  it('renders a new card once the title changes', async function () {
    const before = await getPng(`/e/${code}/og.png`)
    await callAsUser(family.users.ola, 'events.update', {
      eventId: family.eventId,
      title: 'Wigilia u babci',
    })
    const after = await getPng(`/e/${code}/og.png`)

    assert.strictEqual((await cards()).length, 2)
    assert.ok(!after.bytes.equals(before.bytes))
  })

  it('renders the new code’s own card after a rotation', async function () {
    await getPng(`/e/${code}/og.png`)
    const fresh = await rotateInvite(family.eventId)
    await getPng(`/e/${fresh}/og.png`)

    assert.strictEqual((await cards()).length, 2)
  })

  it('gives a code that opens nothing the brand card', async function () {
    const brand = await getPng('/og.png')
    await rotateInvite(family.eventId)
    const rotated = await getPng(`/e/${code}/og.png`)
    const never = await getPng('/e/zzzz/og.png')

    assert.strictEqual(brand.res.status, 200)
    const { width, height } = await sharp(brand.bytes).metadata()
    assert.deepStrictEqual({ width, height }, { width: 1200, height: 630 })
    assert.ok(rotated.bytes.equals(brand.bytes))
    assert.ok(never.bytes.equals(brand.bytes))
  })

  it('fits a long title, a long name and an emoji', async function () {
    await callAsUser(family.users.ola, 'events.update', {
      eventId: family.eventId,
      title:
        'Urodziny babci Krystyny — osiemdziesiątka! 🎂 Wszyscy razem, cała rodzina, od Gdańska po Zakopane, z dziećmi i wnukami',
    })
    await Meteor.users.updateAsync(family.users.ola, {
      $set: {
        'profile.name': 'Małgorzata Wiśniewska-Kowalczyk-Brzęczyszczykiewicz',
      },
    })
    const { res, bytes } = await getPng(`/e/${code}/og.png`)

    assert.strictEqual(res.status, 200)
    const { width, height } = await sharp(bytes).metadata()
    assert.deepStrictEqual({ width, height }, { width: 1200, height: 630 })
  })
})
