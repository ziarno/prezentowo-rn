import type { ImageRef } from '@prezentowo/types'

// A photo picked in a wizard that is still only on the device. It's uploaded
// when the wizard saves, so replacing, removing or abandoning it leaves
// nothing behind on the server.
export type LocalPhoto = { kind: 'local'; uri: string }

// A wizard's image field: a saved `ImageRef`, or a photo not yet uploaded.
export type DraftImage = ImageRef | LocalPhoto

// A photo: an upload, or one picked in a wizard and still on the device.
export type Photo = Exclude<DraftImage, { kind: 'illustration' }>

export const isPhoto = (image: DraftImage | undefined): image is Photo =>
  image?.kind === 'upload' || image?.kind === 'local'

const sameImage = (a: ImageRef, b: ImageRef) =>
  a.kind === b.kind && a.id === b.id

/**
 * What an update sends for an image field that was `saved` and is now
 * `next`: undefined when unchanged, null when removed (the server then
 * deletes a dropped upload), else the new image.
 */
export function imageChange(
  saved: ImageRef | undefined,
  next: ImageRef | undefined,
): ImageRef | null | undefined {
  if (!next) return saved ? null : undefined
  return saved && sameImage(saved, next) ? undefined : next
}

/**
 * The saved image a field holds, for a save payload. Throws for a photo still
 * on the device: `uploadDraftImage` must have run first.
 */
export function savedImage(
  image: DraftImage | undefined,
): ImageRef | undefined {
  if (image?.kind === 'local') {
    throw new Error('A picked photo must be uploaded before saving')
  }
  return image
}

/**
 * The field's `ImageRef`, uploading it with `upload` first when it is still
 * a photo on the device.
 */
export async function uploadDraftImage(
  image: DraftImage | undefined,
  upload: (localUri: string) => Promise<ImageRef>,
): Promise<ImageRef | undefined> {
  return image?.kind === 'local' ? upload(image.uri) : image
}
