import { Meteor } from 'meteor/meteor'

import '../imports/startup/main-server'
import '../imports/startup/server/accounts.config'
import '../imports/startup/server/accounts.devLogin'
import '../imports/startup/server/accounts.emails'
import '../imports/startup/server/images.sweep'

Meteor.startup(async () => {})
