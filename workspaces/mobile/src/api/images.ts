import type {
  ImageRef,
  ImageSize,
  UploadImageErrorCode,
  UploadImageResult,
} from '@prezentowo/types'
import { File } from 'expo-file-system'
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'
import { fetch } from 'expo/fetch'

import type { LocalPhoto } from '@/api/draftImage'
import { BACKEND_HTTP_URL } from '@/constants/backend'
import { NetworkError, authToken } from '@/sync'

// docs/spec.md §3.1: the client downscales before uploading, since the
// server's uplink also carries DDP. 1600 px is the largest derivative.
const MAX_LONG_EDGE = 1600
const JPEG_QUALITY = 0.7
const UPLOAD_TIMEOUT_MS = 60_000

const ROUTE = 'POST /api/images'

// `unauthorized`: no session, or the server rejected its token. `failed`:
// any other non-2xx. The rest are the route's own codes.
export type ImageUploadErrorKind =
  | UploadImageErrorCode
  | 'unauthorized'
  | 'failed'

// i18n keys `images.uploadErrors.<code>` exist for every code.
export class ImageUploadError extends Error {
  readonly code: ImageUploadErrorKind

  constructor(code: ImageUploadErrorKind) {
    super(`${ROUTE}: ${code}`)
    this.name = 'ImageUploadError'
    this.code = code
  }
}

// A Record, so adding a code to UploadImageErrorCode fails to compile here
// until it's listed.
const ROUTE_CODES: Record<UploadImageErrorCode, true> = {
  expectedOneFile: true,
  tooLarge: true,
  notAnImage: true,
}

const isRouteCode = (code: unknown): code is UploadImageErrorCode =>
  typeof code === 'string' && Object.hasOwn(ROUTE_CODES, code)

// A JPEG no larger than MAX_LONG_EDGE on its long edge.
async function downscale(localUri: string) {
  const original = await ImageManipulator.manipulate(localUri).renderAsync()
  const { width, height } = original
  const image =
    Math.max(width, height) > MAX_LONG_EDGE
      ? await ImageManipulator.manipulate(original)
          .resize(
            width >= height
              ? { width: MAX_LONG_EDGE }
              : { height: MAX_LONG_EDGE },
          )
          .renderAsync()
      : original
  return image.saveAsync({ compress: JPEG_QUALITY, format: SaveFormat.JPEG })
}

async function errorFrom(response: Awaited<ReturnType<typeof fetch>>) {
  if (response.status === 401) return new ImageUploadError('unauthorized')
  const body = (await response.json().catch(() => null)) as {
    error?: unknown
  } | null
  const code = body?.error
  return new ImageUploadError(isRouteCode(code) ? code : 'failed')
}

/**
 * Downscales the photo at `localUri` (≤1600 px, JPEG q0.7) and uploads it
 * with the session's login token. Resolves with the upload's `ImageRef`.
 * Rejects with `ImageUploadError` when there's no session or the server
 * refuses the file, and with `NetworkError` when it can't be reached or
 * doesn't answer within `timeoutMs` (the upload may still have landed).
 */
export async function uploadImage(
  localUri: string,
  { timeoutMs = UPLOAD_TIMEOUT_MS }: { timeoutMs?: number } = {},
): Promise<Extract<ImageRef, { kind: 'upload' }>> {
  const token = authToken()
  if (!token) throw new ImageUploadError('unauthorized')

  const jpeg = await downscale(localUri)
  const body = new FormData()
  // expo/fetch sends a File from expo-file-system as a file part (named, and
  // typed image/jpeg, from its path). It rejects React Native's
  // `{ uri, name, type }` part.
  body.append('file', new File(jpeg.uri))

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  let response: Awaited<ReturnType<typeof fetch>>
  try {
    response = await fetch(`${BACKEND_HTTP_URL}/api/images`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body,
      signal: controller.signal,
    })
  } catch {
    throw new NetworkError(
      controller.signal.aborted ? 'timeout' : 'disconnected',
      ROUTE,
    )
  } finally {
    clearTimeout(timer)
  }

  if (!response.ok) throw await errorFrom(response)
  const { id } = (await response.json()) as UploadImageResult
  return { kind: 'upload', id }
}

// Where a photo shows from: the device while it's still a wizard's pick,
// else the upload's `size` derivative.
export function photoUri(
  image: LocalPhoto | Extract<ImageRef, { kind: 'upload' }>,
  size: ImageSize,
): string {
  return image.kind === 'local' ? image.uri : uploadImageUrl(image.id, size)
}

// Where an upload's WebP derivative is served (docs/spec.md §3.1). The id is
// the capability, so the URL needs no token.
export function uploadImageUrl(id: string, size: ImageSize): string {
  return `${BACKEND_HTTP_URL}/images/${id}/${size}.webp`
}
