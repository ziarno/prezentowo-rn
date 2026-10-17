import type { PushPreferences } from '@prezentowo/types'
import 'meteor/meteor'

// @types/meteor leaves UserProfile empty for apps to fill in.
declare module 'meteor/meteor' {
  namespace Meteor {
    interface UserProfile {
      name?: string
      avatar?: string
      // An upload id, shown instead of `avatar` (docs/spec.md §1.10).
      photo?: string
    }

    interface User {
      // `profile.name` folded and split, for `users.search`. Server-only:
      // no publication sends it.
      nameTokens?: string[]
      // The first-login date of birth, `YYYY-MM-DD` (docs/spec.md §1.15), top
      // level and not under `profile` so no publication of a profile can
      // carry it. Published to the user alone; missing = not answered yet.
      // Whether someone is 13 or 16 is computed from it, never stored.
      birthDate?: string
      // Published to the user alone (docs/spec.md §1.13); missing = on.
      pushPreferences?: PushPreferences
    }
  }
}
