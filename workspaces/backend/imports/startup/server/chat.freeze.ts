import { Meteor } from 'meteor/meteor'

import { freezeRetiredThreads } from '../../api/chat/chat.sync'

// Doesn't hold up startup: a freeze Stream refuses is retried in the
// background anyway.
Meteor.startup(
  () =>
    void freezeRetiredThreads().catch(error =>
      console.error('chat: freezing retired threads failed', error),
    ),
)
