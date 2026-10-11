import type { EventDoc, EventParticipant } from '@prezentowo/types'
import type { Mongo } from 'meteor/mongo'

import { Activity } from '../activity/activity.collection'
import { deleteChatThreads } from '../chat/chat.sync'
import { type GiftRecord, Gifts } from '../gifts/gifts.collection'
import { asUpload, releaseImage } from '../images/images.refs'
import { Invites } from '../invites/invites.collection'
import { Notifications } from '../notifications/notifications.collection'
import { clearInvited } from '../notifications/notifications.records'

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
 * (docs/spec.md §2.2): the presents for them, their claims, and the activity
 * about them. Presents they added for others, and activity they're the actor
 * of, stay. Call it once they're out of `event.participants`, so no new
 * present can be added for them meanwhile. Chat is caught up separately,
 * by `syncChatThreads`.
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
  await Activity.removeAsync({
    eventId: event._id,
    recipientParticipantId: participant.id,
  })
  // A removed reservation takes its invitation with it.
  if (participant.kind === 'placeholder' && participant.invitedUserId) {
    await clearInvited(participant.invitedUserId, event._id)
  }
  if (participant.kind === 'placeholder') {
    await releaseImage(asUpload(participant.photo))
  }
}

/**
 * Everything a deleted event owns (docs/spec.md §2.2): its presents, its
 * invite, its activity, its chat threads and their Stream channels, and the
 * uploads the event, its placeholders and its presents point at. Call it
 * once the `Events` doc is gone, so nothing new is added to it meanwhile —
 * except `deleteAccountFor`, which runs it first so a run that dies before
 * the event goes is simply repeated.
 * Every collection keyed by `eventId` is deleted here.
 */
export async function cascadeEventDeletion(event: EventDoc) {
  await Invites.removeAsync({ eventId: event._id })
  await Activity.removeAsync({ eventId: event._id })
  await Notifications.removeAsync({ eventId: event._id })
  await deleteChatThreads(event._id)
  await deleteGifts({ eventId: event._id })
  await releaseImage(event.background)
  for (const p of event.participants) {
    if (p.kind === 'placeholder') await releaseImage(asUpload(p.photo))
  }
}
