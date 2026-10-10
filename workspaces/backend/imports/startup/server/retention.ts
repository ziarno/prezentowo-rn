import { Meteor } from 'meteor/meteor'

import { sweepNeverSignedInUsers } from '../../api/accounts/accounts.retention'
import { sweepStaleOgCards } from '../../landing/landing.ogCard.sweep'

const DAY_MS = 24 * 60 * 60 * 1000

const jobs = [
  { name: 'never-signed-in user', run: sweepNeverSignedInUsers },
  { name: 'stale OG card', run: sweepStaleOgCards },
]

/** Runs the retention jobs (docs/spec.md §3.8) now, then daily. */
export function scheduleRetentionJobs(): void {
  const sweep = () =>
    Promise.all(
      jobs.map(({ name, run }) =>
        run().catch(error => console.error(`The ${name} sweep failed`, error)),
      ),
    )
  void sweep()
  Meteor.setInterval(sweep, DAY_MS)
}

Meteor.startup(scheduleRetentionJobs)
