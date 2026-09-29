import type { ImageRef } from '@prezentowo/types'
import { Meteor } from 'meteor/meteor'

import { Images } from './images.collection'
import { deleteImage } from './images.storage'

/**
 * Asserts an upload `image` is one `userId` uploaded. Deleting an image
 * deletes its upload (docs/spec.md §3.1), so a document must never point at
 * someone else's: its id is visible to every member who can see it. A
 * missing upload and someone else's are the same `notFound`.
 */
export async function assertOwnUpload(
  image: ImageRef | null | undefined,
  userId: string,
): Promise<void> {
  if (image?.kind !== 'upload') return
  const record = await Images.findOneAsync(
    { _id: image.id, ownerId: userId },
    { fields: { _id: 1 } },
  )
  if (!record) throw new Meteor.Error('notFound', 'imageNotFound')
}

/**
 * Asserts an `illustration` image is stock art bundled for its field
 * (docs/spec.md §1.1): `ids` is the field's allowlist from
 * `@prezentowo/types`, presents for a gift and backgrounds for an event.
 */
export function assertStockArt(
  image: ImageRef | null | undefined,
  ids: readonly string[],
): void {
  if (image?.kind !== 'illustration') return
  if (!ids.includes(image.id)) {
    throw new Meteor.Error('invalidArgs', 'unknownIllustration')
  }
}

/**
 * Deletes the upload `previous` pointed at once a document has dropped it for
 * `next` (a different image, or none). Call it after the write that dropped
 * it. A failed delete is logged, not thrown: the write has already landed.
 */
export async function releaseImage(
  previous: ImageRef | undefined,
  next?: ImageRef | null,
): Promise<void> {
  if (previous?.kind !== 'upload') return
  if (next?.kind === 'upload' && next.id === previous.id) return
  try {
    await deleteImage(previous.id)
  } catch (error) {
    console.error('Deleting a dropped upload failed', error)
  }
}
