import { Accounts } from 'meteor/accounts-base'
import { Meteor } from 'meteor/meteor'

const defaultFieldSelector = {
  _id: 1,
  emails: 1,
  firstName: 1,
  lastName: 1,
}

Accounts.config({
  ...Meteor.settings.accounts.config,
  defaultFieldSelector,
})
