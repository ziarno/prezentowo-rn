import { Meteor } from 'meteor/meteor'

import { hydrateLanding } from '../imports/landing/landing.client'

Meteor.startup(hydrateLanding)
