import { upperFirst } from '@prezentowo/types'
import { Meteor } from 'meteor/meteor'
import type { Mongo } from 'meteor/mongo'

import { Activity } from '../../api/activity/activity.collection'
import { Events } from '../../api/events/events.collection'
import { Gifts } from '../../api/gifts/gifts.collection'
import { Notifications } from '../../api/notifications/notifications.collection'
import { nameFields } from '../../api/users/users.nameTokens'

// Activity and notifications keep the gift's title as it was when written.
async function capitalizeGiftTitles<
  T extends { _id: string; giftTitle?: string },
>(collection: Mongo.Collection<T>) {
  const docs = await collection
    .find({ giftTitle: { $type: 'string' } }, { fields: { giftTitle: 1 } })
    .fetchAsync()
  for (const { _id, giftTitle } of docs) {
    const capitalized = upperFirst(giftTitle!)
    if (capitalized !== giftTitle) {
      await collection.updateAsync(_id, {
        $set: { giftTitle: capitalized } as Partial<T>,
      })
    }
  }
}

// One-off: capitalizes the titles and names stored before every write went
// through `upperFirst`, snapshots included. A no-op once it has run, since
// nothing writes an uncapitalized one any more; delete it after it has run
// in production.
async function capitalizeStored() {
  for (const event of await Events.find(
    {},
    { fields: { title: 1, participants: 1 } },
  ).fetchAsync()) {
    const title = upperFirst(event.title)
    let changed = title !== event.title
    const participants = event.participants.map(p => {
      if (p.kind !== 'placeholder' || upperFirst(p.name) === p.name) return p
      changed = true
      return { ...p, name: upperFirst(p.name) }
    })
    if (changed) {
      await Events.updateAsync(event._id, { $set: { title, participants } })
    }
  }

  for (const gift of await Gifts.find(
    {},
    { fields: { title: 1 } },
  ).fetchAsync()) {
    const title = upperFirst(gift.title)
    if (title !== gift.title)
      await Gifts.updateAsync(gift._id, { $set: { title } })
  }

  await capitalizeGiftTitles(Activity)
  await capitalizeGiftTitles(Notifications)

  for (const user of await Meteor.users
    .find(
      { 'profile.name': { $type: 'string' } },
      { fields: { 'profile.name': 1 } },
    )
    .fetchAsync()) {
    const name = user.profile!.name!
    if (upperFirst(name) !== name) {
      await Meteor.users.updateAsync(user._id, { $set: nameFields(name) })
    }
  }
}

Meteor.startup(capitalizeStored)
