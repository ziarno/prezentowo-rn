import 'meteor/meteor'

// @types/meteor leaves UserProfile empty for apps to fill in.
declare module 'meteor/meteor' {
  namespace Meteor {
    interface UserProfile {
      name?: string
      avatar?: string
    }
  }
}
