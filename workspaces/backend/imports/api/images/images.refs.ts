import type { ImageRef } from '@prezentowo/types'
import { Meteor } from 'meteor/meteor'

import { Images } from './images.collection'
import { deleteImage } from './images.storage'

type AttachOptions = {
  /** The image the write stores. Only an upload is attached. */
  image: ImageRef | null | undefined
  userId: string
  /** The image the document holds now: sending it again attaches nothing. */
  current?: ImageRef
}

/**
 * Runs `write`, the insert or update that stores `image` on a document, with
 * the upload attached to it (docs/spec.md §3.1). An upload is attached once,
 * to one document, by its uploader: deleting a document deletes its upload,
 * so a document must never point at someone else's (its id is visible to
 * every member) or at one another document holds. A missing upload and
 * someone else's are the same `notFound`; one already attached is
 * `imageInUse`. If `write` throws, the upload is detached again, so the
 * sweep can still collect it.
 */
export async function withUploadAttached<T>(
  { image, userId, current }: AttachOptions,
  write: () => Promise<T>,
): Promise<T> {
  if (image?.kind !== 'upload') return write()
  if (current?.kind === 'upload' && current.id === image.id) return write()

  const attached = await Images.updateAsync(
    { _id: image.id, ownerId: userId, attachedAt: { $exists: false } },
    { $set: { attachedAt: new Date() } },
  )
  if (!attached) {
    const own = await Images.findOneAsync(
      { _id: image.id, ownerId: userId },
      { fields: { _id: 1 } },
    )
    throw own
      ? new Meteor.Error('invalidArgs', 'imageInUse')
      : new Meteor.Error('notFound', 'imageNotFound')
  }

  try {
    return await write()
  } catch (error) {
    await Images.updateAsync(image.id, { $unset: { attachedAt: '' } }).catch(
      detachError => console.error('Detaching an upload failed', detachError),
    )
    throw error
  }
}

/**
 * `withUploadAttached` for several images stored by one write, e.g. an
 * event's background and its placeholders' photos. One upload sent twice is
 * `imageInUse`; whatever fails, none stays attached.
 */
export function withUploadsAttached<T>(
  { images, userId }: { images: (ImageRef | undefined)[]; userId: string },
  write: () => Promise<T>,
): Promise<T> {
  return images.reduceRight<() => Promise<T>>(
    (inner, image) => () => withUploadAttached({ image, userId }, inner),
    write,
  )()
}

/** An upload id stored as a plain string, e.g. a photo, as an `ImageRef`. */
export const asUpload = (
  id: string | null | undefined,
): ImageRef | undefined => (id ? { kind: 'upload', id } : undefined)

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
