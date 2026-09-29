/// <reference types="jest" />
import type { ImageRef } from '@prezentowo/types'

import { imageChange, savedImage, uploadDraftImage } from '../draftImage'

const upload = (id: string): ImageRef => ({ kind: 'upload', id })
const art = (id: string): ImageRef => ({ kind: 'illustration', id })

describe('imageChange', () => {
  it('sends nothing when the image is unchanged', () => {
    expect(imageChange(undefined, undefined)).toBeUndefined()
    expect(imageChange(upload('a'), upload('a'))).toBeUndefined()
    expect(imageChange(art('p3'), art('p3'))).toBeUndefined()
  })

  it('sends null when the image was removed', () => {
    expect(imageChange(upload('a'), undefined)).toBeNull()
  })

  it('sends the new image when it was added or replaced', () => {
    expect(imageChange(undefined, upload('b'))).toEqual(upload('b'))
    expect(imageChange(upload('a'), upload('b'))).toEqual(upload('b'))
    expect(imageChange(art('p3'), upload('a'))).toEqual(upload('a'))
    expect(imageChange(upload('a'), art('p3'))).toEqual(art('p3'))
  })
})

describe('uploadDraftImage', () => {
  it('uploads a photo still on the device', async () => {
    const send = jest.fn(async () => upload('new'))

    await expect(
      uploadDraftImage({ kind: 'local', uri: 'file:///photo.jpg' }, send),
    ).resolves.toEqual(upload('new'))
    expect(send).toHaveBeenCalledWith('file:///photo.jpg')
  })

  it('passes a saved image, or none, through without uploading', async () => {
    const send = jest.fn(async () => upload('new'))

    await expect(uploadDraftImage(upload('a'), send)).resolves.toEqual(
      upload('a'),
    )
    await expect(uploadDraftImage(art('p3'), send)).resolves.toEqual(art('p3'))
    await expect(uploadDraftImage(undefined, send)).resolves.toBeUndefined()
    expect(send).not.toHaveBeenCalled()
  })
})

describe('savedImage', () => {
  it('passes a saved image, or none, through', () => {
    expect(savedImage(upload('a'))).toEqual(upload('a'))
    expect(savedImage(undefined)).toBeUndefined()
  })

  it('refuses a photo that has not been uploaded yet', () => {
    expect(() => savedImage({ kind: 'local', uri: 'file:///p.jpg' })).toThrow()
  })
})
