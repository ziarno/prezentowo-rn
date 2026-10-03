import { Meteor } from 'meteor/meteor'

import { Events } from '../events/events.collection'
import { Gifts } from '../gifts/gifts.collection'
import { Images } from './images.collection'
import { deleteImage } from './images.storage'

const DAY_MS = 24 * 60 * 60 * 1000

// Whether a gift or event points at upload `id`. Uploads stored before
// attaching existed are on documents but have no `attachedAt`.
const isReferenced = async (id: string) =>
  !!(
    (await Gifts.findOneAsync(
      { 'image.kind': 'upload', 'image.id': id },
      { fields: { _id: 1 } },
    )) ??
    (await Events.findOneAsync(
      { 'background.kind': 'upload', 'background.id': id },
      { fields: { _id: 1 } },
    ))
  )

/**
 * Deletes every upload no document took within a day of it arriving, files
 * and record (docs/spec.md §3.1). Clients upload at save time, seconds
 * before the write that attaches it, so a day is a wide margin. One a gift
 * or event points at anyway is marked attached instead.
 */
export async function sweepUnattachedUploads(): Promise<void> {
  const ids = await Images.find(
    {
      attachedAt: { $exists: false },
      createdAt: { $lt: new Date(Date.now() - DAY_MS) },
    },
    { fields: { _id: 1 } },
  ).mapAsync(image => image._id)
  for (const id of ids) {
    try {
      if (await isReferenced(id)) {
        await Images.updateAsync(id, { $set: { attachedAt: new Date() } })
      } else {
        await deleteImage(id)
      }
    } catch (error) {
      console.error('Sweeping an unattached upload failed', error)
    }
  }
}

/** Sweeps once now, then daily, for as long as the server runs. */
export function scheduleUploadSweep(): void {
  const sweep = () =>
    sweepUnattachedUploads().catch(error =>
      console.error('The unattached upload sweep failed', error),
    )
  void sweep()
  Meteor.setInterval(sweep, DAY_MS)
}
