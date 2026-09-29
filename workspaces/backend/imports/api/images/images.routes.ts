import type {
  ImageSize,
  UploadImageErrorCode,
  UploadImageResult,
} from '@prezentowo/types'
import busboy from 'busboy'
import type { Request, Response } from 'express'
import { createAuthMiddleware } from 'meteor/accounts-express'
import { Meteor } from 'meteor/meteor'
import { WebApp } from 'meteor/webapp'

import {
  IMAGE_SIZES,
  MAX_UPLOAD_BYTES,
  NotAnImageError,
  imagePath,
  isImageId,
  storeImage,
} from './images.storage'

class UploadError extends Error {
  constructor(
    readonly status: number,
    readonly code: UploadImageErrorCode,
  ) {
    super(code)
  }
}

/**
 * Reads the one file in a multipart body. Rejects with `UploadError` for no
 * file, more than one, a declared type that isn't an image, or one over
 * `MAX_UPLOAD_BYTES`. Always reads the whole body before settling, so the
 * error response isn't cut off by a client still sending.
 */
function readSingleFile(req: Request): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    let parser: busboy.Busboy
    try {
      parser = busboy({
        headers: req.headers,
        limits: { files: 1, fileSize: MAX_UPLOAD_BYTES },
      })
    } catch {
      // Not multipart/form-data, or no boundary.
      req.resume()
      req.on('end', () => reject(new UploadError(400, 'expectedOneFile')))
      return
    }

    const chunks: Buffer[] = []
    let files = 0
    let failure: UploadError | undefined
    const fail = (error: UploadError) => void (failure ??= error)

    parser.on('file', (_field, stream, { mimeType }) => {
      files += 1
      if (!mimeType.startsWith('image/')) {
        fail(new UploadError(415, 'notAnImage'))
      }
      stream.on('data', (chunk: Buffer) => chunks.push(chunk))
      stream.on('limit', () => fail(new UploadError(413, 'tooLarge')))
    })
    parser.on('filesLimit', () => fail(new UploadError(400, 'expectedOneFile')))
    parser.on('error', () => fail(new UploadError(400, 'expectedOneFile')))
    parser.on('close', () => {
      if (!failure && files !== 1)
        failure = new UploadError(400, 'expectedOneFile')
      if (failure) reject(failure)
      else resolve(Buffer.concat(chunks))
    })
    req.pipe(parser)
  })
}

const sendError = (
  res: Response,
  status: number,
  error: UploadImageErrorCode,
) => res.status(status).json({ error })

async function uploadImage(req: Request, res: Response) {
  try {
    const upload = await readSingleFile(req)
    const id = await storeImage(upload, req.userId!)
    res.json({ id } satisfies UploadImageResult)
  } catch (error) {
    if (error instanceof UploadError) {
      return sendError(res, error.status, error.code)
    }
    if (error instanceof NotAnImageError) {
      return sendError(res, 415, 'notAnImage')
    }
    console.error('POST /api/images failed', error)
    res.status(500).end()
  }
}

// docs/spec.md §3.1. The client sends the login token its DDP session holds.
WebApp.handlers.post(
  '/api/images',
  createAuthMiddleware({ required: true }),
  uploadImage,
)

const sizeOf = (file: string) =>
  IMAGE_SIZES.find(size => file === `${size}.webp`) as ImageSize | undefined

// Caddy serves /images/* in production. This stands in for it while
// developing, with the same unauthenticated, bearer-capability URLs.
function serveImage(req: Request, res: Response) {
  const { id, file } = req.params as { id: string; file: string }
  const size = sizeOf(file)
  if (!isImageId(id) || !size) return void res.status(404).end()

  res.sendFile(
    imagePath(id, size),
    // `allow`: send ignores any path with a dot segment by default, and the
    // dev IMAGES_DIR is `.images`. The id and size are validated above.
    { headers: { 'Content-Type': 'image/webp' }, dotfiles: 'allow' },
    error => {
      if (error && !res.headersSent) res.status(404).end()
    },
  )
}

if (Meteor.isDevelopment) {
  WebApp.handlers.get('/images/:id/:file', serveImage)
}
