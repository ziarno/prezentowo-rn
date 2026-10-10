import { Meteor } from 'meteor/meteor'

const DAY_MS = 24 * 60 * 60 * 1000

const GRACE_DAYS = 7

/**
 * Deletes every user created over `GRACE_DAYS` (7) days ago with no `profile.name` and no
 * login token (docs/spec.md §3.8). `requestMagicLink` pre-creates a user for
 * any typed address; one who never finished first login owns no data.
 */
export async function sweepNeverSignedInUsers(): Promise<void> {
  await Meteor.users.removeAsync({
    createdAt: { $lt: new Date(Date.now() - GRACE_DAYS * DAY_MS) },
    'profile.name': { $in: [null, ''] },
    $or: [
      { 'services.resume.loginTokens': { $exists: false } },
      { 'services.resume.loginTokens': { $size: 0 } },
    ],
  })
}
