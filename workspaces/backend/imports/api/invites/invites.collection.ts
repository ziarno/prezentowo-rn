import type { InviteDoc } from '@prezentowo/types'
import { Meteor } from 'meteor/meteor'
import { Mongo } from 'meteor/mongo'

export const Invites = new Mongo.Collection<InviteDoc>('invites')

export async function createInviteIndexes() {
  await Invites.createIndexAsync({ code: 1 }, { unique: true })
  await Invites.createIndexAsync({ eventId: 1 }, { unique: true })
}

Meteor.startup(createInviteIndexes)
