import type { UploadImageResult } from '@prezentowo/types'
import assert from 'assert'
import { existsSync } from 'fs'
import { mkdtemp, readdir, rm, writeFile } from 'fs/promises'
import { Meteor } from 'meteor/meteor'
import { tmpdir } from 'os'
import { join } from 'path'
import sharp from 'sharp'

import { createUser } from '../../../tests/fixtures'
import { createLoginToken, resetDatabase } from '../../../tests/helpers'
import { isStored, uploadAs } from '../../../tests/images'
import { Events } from '../events/events.collection'
import { Gifts } from '../gifts/gifts.collection'
import { Images } from './images.collection'
import './images.routes'
import { MAX_UPLOAD_BYTES, deleteImage, imagesDir } from './images.storage'
import { sweepUnattachedUploads } from './images.sweep'

const uploadUrl = Meteor.absoluteUrl('api/images')

const photo = (width: number, height: number) =>
  sharp({
    create: { width, height, channels: 3, background: '#c33' },
  })
    .jpeg({ quality: 70 })
    .toBuffer()

type Part = { bytes: Buffer | Uint8Array; type?: string; name?: string }

async function upload(token: string | null, ...parts: Part[]) {
  const form = new FormData()
  for (const { bytes, type = 'image/jpeg', name = 'photo.jpg' } of parts) {
    form.append('file', new Blob([new Uint8Array(bytes)], { type }), name)
  }
  return fetch(uploadUrl, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  })
}

const storedIds = async () =>
  existsSync(imagesDir()) ? readdir(imagesDir()) : []

describe('images', function () {
  let userId: string
  let token: string
  let savedDir: unknown
  // IMAGES_DIR is <sandbox>/.images: a dot directory like the dev setting, and
  // a sibling for the traversal tests to lose.
  let sandbox: string
  const sentinel = () => join(sandbox, 'sentinel')

  before(async function () {
    savedDir = Meteor.settings.imagesDir
    sandbox = await mkdtemp(join(tmpdir(), 'images-'))
    Meteor.settings.imagesDir = join(sandbox, '.images')
  })

  after(async function () {
    await rm(sandbox, { recursive: true, force: true })
    Meteor.settings.imagesDir = savedDir
  })

  beforeEach(async function () {
    await resetDatabase()
    await rm(imagesDir(), { recursive: true, force: true })
    userId = await createUser('Ola')
    token = await createLoginToken(userId)
  })

  describe('POST /api/images', function () {
    it('rejects a request without a login token', async function () {
      const res = await upload(null, { bytes: await photo(800, 600) })

      assert.strictEqual(res.status, 401)
      assert.deepStrictEqual(await storedIds(), [])
      assert.strictEqual(await Images.find().countAsync(), 0)
    })

    it('rejects an unknown login token', async function () {
      const res = await upload('not-a-token', { bytes: await photo(800, 600) })

      assert.strictEqual(res.status, 401)
      assert.deepStrictEqual(await storedIds(), [])
    })

    it('stores three WebP derivatives and nothing else', async function () {
      const res = await upload(token, { bytes: await photo(1600, 1200) })

      assert.strictEqual(res.status, 200)
      const { id } = (await res.json()) as UploadImageResult
      assert.deepStrictEqual(await storedIds(), [id])
      assert.deepStrictEqual((await readdir(join(imagesDir(), id))).sort(), [
        '1000.webp',
        '1600.webp',
        '400.webp',
      ])
      for (const size of [400, 1000, 1600]) {
        const meta = await sharp(
          join(imagesDir(), id, `${size}.webp`),
        ).metadata()
        assert.strictEqual(meta.format, 'webp')
        assert.strictEqual(meta.width, size, `${size}.webp width`)
        assert.strictEqual(meta.height, (size * 3) / 4, `${size}.webp height`)
      }
    })

    it('fits the long edge of a portrait photo', async function () {
      const res = await upload(token, { bytes: await photo(900, 1600) })
      const { id } = (await res.json()) as UploadImageResult

      const meta = await sharp(join(imagesDir(), id, '400.webp')).metadata()
      assert.strictEqual(meta.height, 400)
      assert.strictEqual(meta.width, 225)
    })

    it('never enlarges a small photo', async function () {
      const res = await upload(token, { bytes: await photo(600, 450) })
      const { id } = (await res.json()) as UploadImageResult

      const meta = await sharp(join(imagesDir(), id, '1600.webp')).metadata()
      assert.strictEqual(meta.width, 600)
    })

    it('records who uploaded it under an unguessable id', async function () {
      const res = await upload(token, { bytes: await photo(800, 600) })
      const { id } = (await res.json()) as UploadImageResult

      assert.match(id, /^[A-Za-z0-9_-]{43}$/)
      const record = await Images.findOneAsync(id)
      assert.strictEqual(record?.ownerId, userId)
      assert.ok(record?.createdAt instanceof Date)
    })

    it('rejects a file that is not an image, whatever its declared type', async function () {
      const res = await upload(token, {
        bytes: Buffer.from('definitely not a jpeg'),
        type: 'image/jpeg',
      })

      assert.strictEqual(res.status, 415)
      assert.deepStrictEqual(await res.json(), { error: 'notAnImage' })
      assert.deepStrictEqual(await storedIds(), [])
      assert.strictEqual(await Images.find().countAsync(), 0)
    })

    it('rejects a declared non-image type', async function () {
      const res = await upload(token, {
        bytes: await photo(800, 600),
        type: 'text/plain',
        name: 'notes.txt',
      })

      assert.strictEqual(res.status, 415)
      assert.deepStrictEqual(await res.json(), { error: 'notAnImage' })
    })

    it('rejects an SVG, which sharp would render', async function () {
      const svg = Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"/>',
      )
      const res = await upload(token, {
        bytes: svg,
        type: 'image/svg+xml',
        name: 'x.svg',
      })

      assert.strictEqual(res.status, 415)
      assert.deepStrictEqual(await storedIds(), [])
    })

    it('rejects an upload over the size limit', async function () {
      const res = await upload(token, {
        bytes: new Uint8Array(MAX_UPLOAD_BYTES + 1),
      })

      assert.strictEqual(res.status, 413)
      assert.deepStrictEqual(await res.json(), { error: 'tooLarge' })
      assert.deepStrictEqual(await storedIds(), [])
    })

    it('rejects a request with no file', async function () {
      const res = await upload(token)

      assert.strictEqual(res.status, 400)
      assert.deepStrictEqual(await res.json(), { error: 'expectedOneFile' })
    })

    it('rejects a request with more than one file', async function () {
      const bytes = await photo(800, 600)
      const res = await upload(token, { bytes }, { bytes })

      assert.strictEqual(res.status, 400)
      assert.deepStrictEqual(await res.json(), { error: 'expectedOneFile' })
      assert.deepStrictEqual(await storedIds(), [])
    })

    it('rejects a body that is not multipart', async function () {
      const res = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'image/jpeg',
        },
        body: await photo(800, 600),
      })

      assert.strictEqual(res.status, 400)
      assert.deepStrictEqual(await res.json(), { error: 'expectedOneFile' })
    })
  })

  describe('GET /images/<id>/<size>.webp (development)', function () {
    it('serves a derivative', async function () {
      const res = await upload(token, { bytes: await photo(800, 600) })
      const { id } = (await res.json()) as UploadImageResult

      const image = await fetch(Meteor.absoluteUrl(`images/${id}/400.webp`))

      assert.strictEqual(image.status, 200)
      assert.strictEqual(image.headers.get('content-type'), 'image/webp')
      const meta = await sharp(
        Buffer.from(await image.arrayBuffer()),
      ).metadata()
      assert.strictEqual(meta.width, 400)
    })

    it('404s an unknown id or size', async function () {
      const res = await upload(token, { bytes: await photo(800, 600) })
      const { id } = (await res.json()) as UploadImageResult

      for (const path of [
        `images/${'x'.repeat(43)}/400.webp`,
        `images/${id}/500.webp`,
        `images/${id}/400.png`,
      ]) {
        const image = await fetch(Meteor.absoluteUrl(path))
        assert.strictEqual(image.status, 404, path)
      }
    })
  })

  describe('deleteImage', function () {
    it('removes the files and the record', async function () {
      const res = await upload(token, { bytes: await photo(800, 600) })
      const { id } = (await res.json()) as UploadImageResult

      await deleteImage(id)

      assert.deepStrictEqual(await storedIds(), [])
      assert.strictEqual(await Images.findOneAsync(id), undefined)
    })

    it('leaves other uploads alone', async function () {
      const first = (await (
        await upload(token, { bytes: await photo(800, 600) })
      ).json()) as UploadImageResult
      const second = (await (
        await upload(token, { bytes: await photo(800, 600) })
      ).json()) as UploadImageResult

      await deleteImage(first.id)

      assert.deepStrictEqual(await storedIds(), [second.id])
      assert.ok(await Images.findOneAsync(second.id))
    })

    it('does nothing for an id that was never stored', async function () {
      await deleteImage('x'.repeat(43))
    })

    it('never reaches outside the images directory', async function () {
      const res = await upload(token, { bytes: await photo(800, 600) })
      const { id } = (await res.json()) as UploadImageResult
      await writeFile(sentinel(), '')

      await deleteImage('..')
      await deleteImage(`${id}/..`)
      await deleteImage(`${id}/../..`)
      await deleteImage('')

      assert.ok(existsSync(sentinel()))
      assert.deepStrictEqual(await storedIds(), [id])
    })
  })

  describe('sweepUnattachedUploads', function () {
    const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3600_000)

    const uploadedAt = async (createdAt: Date, attached: boolean) => {
      const { id } = await uploadAs(userId)
      await Images.updateAsync(id, {
        $set: { createdAt, ...(attached ? { attachedAt: createdAt } : {}) },
      })
      return id
    }

    it('deletes unattached uploads older than 24 hours, files and record', async function () {
      const stale = await uploadedAt(hoursAgo(25), false)

      await sweepUnattachedUploads()

      assert.strictEqual(await isStored(stale), false)
    })

    it('keeps attached uploads, however old, and fresh unattached ones', async function () {
      const attached = await uploadedAt(hoursAgo(24 * 30), true)
      const fresh = await uploadedAt(hoursAgo(23), false)

      await sweepUnattachedUploads()

      assert.ok(await isStored(attached))
      assert.ok(await isStored(fresh))
    })

    it('attaches, instead of deleting, an old upload a gift or event points at', async function () {
      // Uploads stored before attaching existed have no attachedAt.
      const onGift = await uploadedAt(hoursAgo(24 * 30), false)
      const onEvent = await uploadedAt(hoursAgo(24 * 30), false)
      await Gifts.rawCollection().insertOne({
        _id: 'gift',
        image: { kind: 'upload', id: onGift },
      } as never)
      await Events.rawCollection().insertOne({
        _id: 'event',
        background: { kind: 'upload', id: onEvent },
      } as never)

      await sweepUnattachedUploads()

      for (const id of [onGift, onEvent]) {
        assert.ok(await isStored(id))
        assert.ok((await Images.findOneAsync(id))?.attachedAt)
      }
    })
  })
})
