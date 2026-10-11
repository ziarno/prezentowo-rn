import { Meteor } from 'meteor/meteor'

// `users.search` matches query words as anchored prefixes of `nameTokens`.
// A web deletion link finds its account by the hashed token.
export async function createUserIndexes() {
  await Meteor.users.createIndexAsync({ nameTokens: 1 })
  await Meteor.users.createIndexAsync(
    { 'services.accountDeletion.hashedToken': 1 },
    { sparse: true },
  )
}

Meteor.startup(createUserIndexes)
