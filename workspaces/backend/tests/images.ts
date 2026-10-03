import { existsSync } from 'fs'
import { mkdtemp, rm } from 'fs/promises'
import { Meteor } from 'meteor/meteor'
import { tmpdir } from 'os'
import { join } from 'path'
import sharp from 'sharp'

import { Images } from '../imports/api/images/images.collection'
import { imagesDir, storeImage } from '../imports/api/images/images.storage'

/**
 * Points `imagesDir` at a fresh temporary directory for the enclosing
 * `describe`, and empties it before each test.
 */
export function useImagesSandbox() {
  let savedDir: unknown
  let sandbox: string

  before(async function () {
    savedDir = Meteor.settings.imagesDir
    sandbox = await mkdtemp(join(tmpdir(), 'images-'))
    Meteor.settings.imagesDir = sandbox
  })

  beforeEach(async function () {
    await rm(imagesDir(), { recursive: true, force: true })
  })

  after(async function () {
    await rm(sandbox, { recursive: true, force: true })
    Meteor.settings.imagesDir = savedDir
  })
}

/** Stores a small photo as `ownerId`'s upload; returns its `ImageRef`. */
export async function uploadAs(ownerId: string) {
  const photo = await sharp({
    create: { width: 40, height: 30, channels: 3, background: '#c33' },
  })
    .jpeg()
    .toBuffer()
  return { kind: 'upload' as const, id: await storeImage(photo, ownerId) }
}

/** Whether an upload's files and its `Images` record both still exist. */
export async function isStored(id: string) {
  const onDisk = existsSync(join(imagesDir(), id))
  const recorded = !!(await Images.findOneAsync(id))
  if (onDisk !== recorded) {
    throw new Error(`upload ${id} is half deleted`)
  }
  return onDisk
}

/** Whether a document has taken upload `id` (docs/spec.md §3.1). */
export async function isAttached(id: string) {
  return !!(await Images.findOneAsync(id))?.attachedAt
}
