import { Meteor } from 'meteor/meteor'

// One-off: the age band (#105) gave way to the date of birth (#110), so a
// stored band is dropped and its owner is asked for a date at the next
// sign-in. Nothing shipped with bands, so this only touches dev data. Runs at
// every start, a no-op once none is left; delete it once it has run
// everywhere.
export async function unsetAgeBand() {
  await Meteor.users
    .rawCollection()
    .updateMany({ ageBand: { $exists: true } }, { $unset: { ageBand: '' } })
}

Meteor.startup(() =>
  unsetAgeBand().catch(error =>
    console.error('Removing the old age bands failed', error),
  ),
)
