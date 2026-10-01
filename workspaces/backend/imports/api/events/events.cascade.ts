import type { EventDoc, EventParticipant } from '@prezentowo/types'
import type { Mongo } from 'meteor/mongo'

import { type GiftRecord, Gifts } from '../gifts/gifts.collection'
import { releaseImage } from '../images/images.refs'
import { Invites } from '../invites/invites.collection'

// Hard-deletes the matching gifts, then their uploads.
async function deleteGifts(selector: Mongo.Selector<GiftRecord>) {
  const images = await Gifts.find(selector, { fields: { image: 1 } }).mapAsync(
    gift => gift.image,
  )
  await Gifts.removeAsync(selector)
  for (const image of images) await releaseImage(image)
}

/**
 * Everything that goes with a participant removed from `event`
 * (docs/spec.md §2.2): the presents for them, and their claims. Presents they
 * added for others stay. Call it once they're out of `event.participants`,
 * so no new present can be added for them meanwhile. Later slices delete
 * their own per-participant data here too (activity, chat).
 */
export async function cascadeParticipantRemoval(
  event: EventDoc,
  participant: EventParticipant,
) {
  if (participant.kind === 'real') {
    await Gifts.updateAsync(
      { eventId: event._id, claimedBy: participant.userId },
      { $pull: { claimedBy: participant.userId } },
      { multi: true },
    )
  }
  await deleteGifts({ eventId: event._id, forParticipantId: participant.id })
}

/**
 * Everything a deleted event owns (docs/spec.md §2.2): its presents, its
 * invite, and the uploads the event and its presents point at. Call it once
 * the `Events` doc is gone, so nothing new is added to it meanwhile. Every
 * collection keyed by `eventId` is deleted here; later slices add theirs
 * (activity, notifications, chat threads).
 */
export async function cascadeEventDeletion(event: EventDoc) {
  await Invites.removeAsync({ eventId: event._id })
  await deleteGifts({ eventId: event._id })
  await releaseImage(event.background)
}
