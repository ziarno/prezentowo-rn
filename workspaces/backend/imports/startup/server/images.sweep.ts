import { Meteor } from 'meteor/meteor'

import { scheduleUploadSweep } from '../../api/images/images.sweep'

Meteor.startup(scheduleUploadSweep)
