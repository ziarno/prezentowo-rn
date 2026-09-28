import { Meteor } from 'meteor/meteor'

import { registerDevLogin } from '../../api/accounts/devLogin'

registerDevLogin(Meteor.isDevelopment)
