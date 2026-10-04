import { Meteor } from 'meteor/meteor'

// `users.search` matches query words as anchored prefixes of `nameTokens`.
export async function createUserIndexes() {
  await Meteor.users.createIndexAsync({ nameTokens: 1 })
}

Meteor.startup(createUserIndexes)
