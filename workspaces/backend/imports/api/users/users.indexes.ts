import { Meteor } from 'meteor/meteor'

// `users.search` only returns 16+ users (equality on `ageBand`, §1.15) whose
// `nameTokens` start with the query words, so the index leads with the band.
// A web deletion link finds its account by the hashed token.
export async function createUserIndexes() {
  await Meteor.users.createIndexAsync({ ageBand: 1, nameTokens: 1 })
  // Superseded by the index above; absent on a fresh database.
  await Meteor.users
    .dropIndexAsync('nameTokens_1')
    .catch((e: { codeName?: string }) => {
      if (e.codeName !== 'IndexNotFound') throw e
    })
  await Meteor.users.createIndexAsync(
    { 'services.accountDeletion.hashedToken': 1 },
    { sparse: true },
  )
}

Meteor.startup(createUserIndexes)
