import 'meteor/meteor'

// @types/meteor leaves UserProfile empty for apps to fill in.
declare module 'meteor/meteor' {
  namespace Meteor {
    interface UserProfile {
      name?: string
      avatar?: string
    }

    interface User {
      // `profile.name` folded and split, for `users.search`. Server-only:
      // no publication sends it.
      nameTokens?: string[]
    }
  }
}
