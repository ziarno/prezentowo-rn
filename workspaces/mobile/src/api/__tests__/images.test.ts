/// <reference types="jest" />
import { NetworkError } from '@/sync/errors'

import { ImageUploadError, uploadImage } from '../images'

type Size = { width?: number | null; height?: number | null }

// A fake of expo-image-manipulator: a local file is a width × height, and
// every render/resize/save is recorded.
const mockPhotos = new Map<string, { width: number; height: number }>()
const mockResizes: Size[] = []
const mockSaves: unknown[] = []

jest.mock('expo-image-manipulator', () => {
  const imageRef = (width: number, height: number) => ({
    width,
    height,
    saveAsync: async (options: unknown) => {
      mockSaves.push(options)
      return { uri: `file:///saved-${width}x${height}.jpg`, width, height }
    },
  })
  return {
    SaveFormat: { JPEG: 'jpeg', PNG: 'png', WEBP: 'webp' },
    ImageManipulator: {
      manipulate: (source: string | ReturnType<typeof imageRef>) => {
        let { width, height } =
          typeof source === 'string' ? mockPhotos.get(source)! : source
        const context = {
          resize: (size: Size) => {
            mockResizes.push(size)
            const ratio = width / height
            if (size.width && !size.height) {
              ;[width, height] = [size.width, Math.round(size.width / ratio)]
            } else if (size.height && !size.width) {
              ;[width, height] = [Math.round(size.height * ratio), size.height]
            }
            return context
          },
          renderAsync: async () => imageRef(width, height),
        }
        return context
      },
    },
  }
})

// expo-file-system's File, which expo/fetch sends as a file part. Records
// the path of every one made.
const mockFileUris: string[] = []
jest.mock('expo-file-system', () => ({
  File: class {
    constructor(uri: string) {
      mockFileUris.push(uri)
    }
  },
}))

jest.mock('expo/fetch', () => ({
  fetch: (url: string, init: RequestInit) => mockFetch(url, init),
}))

jest.mock('@/constants/backend', () => ({
  BACKEND_HTTP_URL: 'http://backend.test:8100',
}))

let mockToken: string | null = 'resume-token'
jest.mock('@/sync', () => ({
  ...jest.requireActual('@/sync/errors'),
  authToken: () => mockToken,
}))

type Sent = { url: string; init: RequestInit }
let mockFetch: (url: string, init: RequestInit) => Promise<Response>
let sent: Sent[]
let respond: (sent: Sent) => Promise<Response>

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

beforeEach(() => {
  mockPhotos.clear()
  mockResizes.length = 0
  mockSaves.length = 0
  mockFileUris.length = 0
  mockToken = 'resume-token'
  sent = []
  respond = async () => json(200, { id: 'abc' })
  mockFetch = async (url, init) => {
    const request = { url, init }
    sent.push(request)
    return respond(request)
  }
})

describe('uploadImage', () => {
  it('posts the photo as JPEG with the session token and returns an upload ref', async () => {
    mockPhotos.set('file:///photo.heic', { width: 1200, height: 900 })

    const ref = await uploadImage('file:///photo.heic')

    expect(ref).toEqual({ kind: 'upload', id: 'abc' })
    expect(mockSaves).toEqual([{ compress: 0.7, format: 'jpeg' }])
    expect(sent).toHaveLength(1)
    const [{ url, init }] = sent
    expect(url).toBe('http://backend.test:8100/api/images')
    expect(init.method).toBe('POST')
    expect(init.headers).toEqual({ Authorization: 'Bearer resume-token' })
    expect(init.body).toBeInstanceOf(FormData)
    expect((init.body as FormData).getAll('file')).toHaveLength(1)
    expect(mockFileUris).toEqual(['file:///saved-1200x900.jpg'])
  })

  it('leaves a photo within 1600 px at its size', async () => {
    mockPhotos.set('file:///small.jpg', { width: 1600, height: 1200 })

    await uploadImage('file:///small.jpg')

    expect(mockResizes).toEqual([])
  })

  it('downscales a landscape photo to 1600 px wide', async () => {
    mockPhotos.set('file:///wide.jpg', { width: 4032, height: 3024 })

    await uploadImage('file:///wide.jpg')

    expect(mockResizes).toEqual([{ width: 1600 }])
  })

  it('downscales a portrait photo to 1600 px tall', async () => {
    mockPhotos.set('file:///tall.jpg', { width: 3024, height: 4032 })

    await uploadImage('file:///tall.jpg')

    expect(mockResizes).toEqual([{ height: 1600 }])
  })

  it('refuses to upload without a session', async () => {
    mockPhotos.set('file:///photo.jpg', { width: 800, height: 600 })
    mockToken = null

    await expect(uploadImage('file:///photo.jpg')).rejects.toMatchObject({
      name: 'ImageUploadError',
      code: 'unauthorized',
    })
    expect(sent).toHaveLength(0)
  })

  it.each([
    [401, { error: 'Unauthorized' }, 'unauthorized'],
    [400, { error: 'expectedOneFile' }, 'expectedOneFile'],
    [413, { error: 'tooLarge' }, 'tooLarge'],
    [415, { error: 'notAnImage' }, 'notAnImage'],
    [500, null, 'failed'],
    [502, { error: 'something new' }, 'failed'],
  ])('maps a %i response to %j → %s', async (status, body, code) => {
    mockPhotos.set('file:///photo.jpg', { width: 800, height: 600 })
    respond = async () =>
      body === null ? new Response('', { status }) : json(status, body)

    const error = await uploadImage('file:///photo.jpg').catch(e => e)

    expect(error).toBeInstanceOf(ImageUploadError)
    expect(error.code).toBe(code)
  })

  it('rejects with a NetworkError when the request fails', async () => {
    mockPhotos.set('file:///photo.jpg', { width: 800, height: 600 })
    respond = async () => {
      throw new TypeError('Network request failed')
    }

    const error = await uploadImage('file:///photo.jpg').catch(e => e)

    expect(error).toBeInstanceOf(NetworkError)
    expect(error.kind).toBe('disconnected')
  })

  it('rejects with a timeout NetworkError when the server never answers', async () => {
    mockPhotos.set('file:///photo.jpg', { width: 800, height: 600 })
    respond = ({ init }) =>
      new Promise((_, reject) =>
        init.signal!.addEventListener('abort', () =>
          reject(new DOMException('Aborted', 'AbortError')),
        ),
      )

    const error = await uploadImage('file:///photo.jpg', {
      timeoutMs: 20,
    }).catch(e => e)

    expect(error).toBeInstanceOf(NetworkError)
    expect(error.kind).toBe('timeout')
  })
})
