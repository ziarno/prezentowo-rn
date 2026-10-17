import { Meteor } from 'meteor/meteor'

const ignoreMissing = (e: { codeName?: string }) => {
  if (e.codeName !== 'IndexNotFound') throw e
}

// `users.search` is a prefix regex on `nameTokens` plus a range on
// `birthDate` (16 or over today, §1.15). Both are ranges, so ESR gives no
// order between them; `nameTokens` leads because its prefix bounds are the
// selective part, and `birthDate` is then checked on the index keys, without
// fetching the document. A web deletion link finds its account by the hashed
// token.
export async function createUserIndexes() {
  await Meteor.users.createIndexAsync({ nameTokens: 1, birthDate: 1 })
  // Superseded by the index above; absent on a fresh database.
  for (const old of ['nameTokens_1', 'ageBand_1_nameTokens_1']) {
    await Meteor.users.dropIndexAsync(old).catch(ignoreMissing)
  }
  await Meteor.users.createIndexAsync(
    { 'services.accountDeletion.hashedToken': 1 },
    { sparse: true },
  )
}

Meteor.startup(createUserIndexes)
