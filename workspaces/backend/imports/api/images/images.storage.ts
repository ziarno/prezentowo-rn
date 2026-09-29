import type { ImageSize } from '@prezentowo/types'
import { mkdir, rm, writeFile } from 'fs/promises'
import { Meteor } from 'meteor/meteor'
import { Random } from 'meteor/random'
import { isAbsolute, join, resolve } from 'path'
import sharp from 'sharp'

import { Images } from './images.collection'

export const IMAGE_SIZES: readonly ImageSize[] = [400, 1000, 1600]

// Clients downscale to ≤1600 px JPEG before uploading (docs/spec.md §3.1), so
// a real upload is well under 1 MB. This only stops abuse.
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

// Decoded-size cap, so a small but hugely dimensioned file can't exhaust
// memory. 5000 × 5000, far above the ≤1600 px clients send.
const MAX_INPUT_PIXELS = 25_000_000

// Formats a phone photo or a downloaded product image can arrive in. sharp
// also decodes SVG, PDF and others; rendering those server-side is a risk
// no upload needs.
const ACCEPTED_FORMATS = new Set(['jpeg', 'png', 'webp', 'heif', 'gif'])

export class NotAnImageError extends Error {
  constructor(cause?: unknown) {
    super('The upload is not a supported image', { cause })
    this.name = 'NotAnImageError'
  }
}

/**
 * Where uploads live, from `imagesDir` in settings.json. A relative path is
 * resolved against the app directory `meteor` runs in. In production it must
 * be a dedicated filesystem, not the Mongo volume (docs/spec.md §3.1).
 */
export function imagesDir(): string {
  const dir: unknown = Meteor.settings.imagesDir
  if (typeof dir !== 'string' || !dir) {
    throw new Error('Meteor.settings.imagesDir is not set')
  }
  // `meteor run` starts the server inside .meteor/local/build, but keeps the
  // PWD of the shell it was started from.
  return isAbsolute(dir) ? dir : resolve(process.env.PWD ?? process.cwd(), dir)
}

// Random.secret()'s alphabet and default length (43 chars, 256 bits).
// Anything else was never an upload id, which keeps a crafted one like `..`
// out of every path below.
const IMAGE_ID = /^[A-Za-z0-9_-]{43}$/
export const isImageId = (id: string) => IMAGE_ID.test(id)

export const imagePath = (id: string, size: ImageSize) =>
  join(imagesDir(), id, `${size}.webp`)

/**
 * Writes the three WebP derivatives of `upload` to `IMAGES_DIR/<id>/` and
 * records `ownerId` as its uploader. The original is not kept. Rejects with
 * `NotAnImageError`, writing nothing, when `upload` isn't an image in an
 * accepted format.
 */
export async function storeImage(
  upload: Buffer,
  ownerId: string,
): Promise<string> {
  const derivatives = await renderDerivatives(upload)

  const id = Random.secret()
  const dir = join(imagesDir(), id)
  await mkdir(dir, { recursive: true })
  try {
    await Promise.all(
      derivatives.map(({ size, webp }) =>
        writeFile(join(dir, `${size}.webp`), webp),
      ),
    )
    await Images.insertAsync({ _id: id, ownerId, createdAt: new Date() })
  } catch (error) {
    await rm(dir, { recursive: true, force: true })
    throw error
  }
  return id
}

// Decodes before anything touches the disk, so a file that isn't an image,
// or is a truncated or corrupt one, fails as NotAnImageError.
async function renderDerivatives(upload: Buffer) {
  try {
    const image = sharp(upload, { limitInputPixels: MAX_INPUT_PIXELS })
    const { format } = await image.metadata()
    if (!format || !ACCEPTED_FORMATS.has(format)) throw new NotAnImageError()

    // rotate() with no angle applies the EXIF orientation; the WebP output
    // drops the rest of the metadata (location included).
    const oriented = image.rotate()
    return await Promise.all(
      IMAGE_SIZES.map(async size => ({
        size,
        webp: await oriented
          .clone()
          .resize({
            width: size,
            height: size,
            fit: 'inside',
            withoutEnlargement: true,
          })
          .webp()
          .toBuffer(),
      })),
    )
  } catch (error) {
    throw error instanceof NotAnImageError ? error : new NotAnImageError(error)
  }
}

/**
 * Removes an upload's directory and its `Images` record. Does nothing for an
 * id that isn't stored, or couldn't be an upload id at all.
 */
export async function deleteImage(id: string): Promise<void> {
  if (!isImageId(id)) return
  await rm(join(imagesDir(), id), { recursive: true, force: true })
  await Images.removeAsync(id)
}
