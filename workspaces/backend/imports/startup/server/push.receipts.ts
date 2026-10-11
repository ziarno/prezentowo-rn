import { Meteor } from 'meteor/meteor'

import { schedulePushReceipts } from '../../api/push/push.receipts'

Meteor.startup(schedulePushReceipts)
