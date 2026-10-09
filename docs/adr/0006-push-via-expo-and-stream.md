# Push through Expo Push Service for the inbox, and through GetStream for chat

Supersedes [ADR 0003](0003-no-push-notifications.md). Prezentowo pushes. With a store release as the goal, a claimed suggestion, a removed gift you may already have bought, or a new chat message should reach people outside the app. Inbox notifications go through **Expo Push Service**. Chat messages go through **GetStream's built-in push**, not through our server. Event-date reminders are still out.

## Considered Options

- **Direct APNs + FCM from Meteor.** Rejected. It would keep the keys and the payload away from third parties, but it means more server code: JWT signing, an HTTP/2 session, sandbox vs production hosts, FCM OAuth and token rotation. Expo does all of that for an Expo account and holding our keys. Each token records its transport, so switching later stays cheap.
- **Chat push via a Stream webhook into our server, then Expo.** Rejected. It would give us one transport, but our server would have to fan out membership and enforce the secret-thread rule, which Stream already does by channel membership.

## Consequences

- Each device registers twice: an Expo token for the inbox, and its raw APNs/FCM token with Stream. Our server does both in `push.register`, so the app never has to `connectUser` for push.
- APNs `.p8` and FCM credentials are uploaded to both Expo and Stream. Firebase is needed for Android only.
- A push only ever mirrors an inbox notification, so the claim-quietly rule needs no extra guard. `invite-deferred` is never pushed.
- Retiring a chat thread mutes push for every member who loses access, before the freeze, and the freeze is retried. A retired thread keeps its members, so a failed freeze would otherwise leak pushes.
- The app-icon badge counts the inbox only. Stream's push template must not set it.
