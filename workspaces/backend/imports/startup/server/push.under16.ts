import { Meteor } from 'meteor/meteor'

import { removePushOfUnder16 } from '../../api/push/push.tokens'

// One-off: accounts from before the age question kept their devices, so
// Stream chat push went on. Runs at every start, a no-op once none is left;
// delete it after it has run in production. A Stream failure leaves the
// rest for the next start rather than keeping the server down.
Meteor.startup(() =>
  removePushOfUnder16().catch(error =>
    console.error('Removing the devices of accounts under 16 failed', error),
  ),
)
