# Chat threads: random channel ids, eager creation, retire instead of edit

Each event has one `event_thread` and one `secret_thread` per recipient; the recipient is never a member of their own secret thread. `ChatThreads` in Mongo records which random Stream channel id backs which thread. The server creates channels eagerly in whichever method changes membership, and `create-channel` is revoked from Stream's `user` role. When someone must lose access to a thread (a beneficiary change, or the removal of its recipient), the thread is **retired** and replaced by a fresh channel. It is never edited.

Stream delivers `notification.removed_from_channel` to the removed user. A derivable channel id would let a giftee tell a 403 from a 404 and learn that a thread about them exists. With `create-channel` held by users, a giftee who guessed an id first would own the channel. Each of these would reveal the secret thread's existence to the one person it is hidden from.

## Considered Options

- **Derived channel ids** (`eventId` + `participantId`). This removes the need for `ChatThreads`, but it creates an existence oracle.
- **Editing membership on a beneficiary change.** Simpler, but the removal is observable.
- **Mirroring messages into Mongo via webhook** (for activity items). Rejected. Server-side calls bypass Stream's permissions, so secret-thread content would land where only our own filters protect it.

## Consequences

- Retired threads keep their history and members in Stream, frozen so nobody can post, but drop out of the UI. Stream still lists them in a member's own queries, so the client asks for the published threads by cid.
- Amended ([#82](https://github.com/ziarno/prezentowo-rn/issues/82), [ADR 0006](../../../../docs/adr/0006-push-via-expo-and-stream.md)): since Stream pushes to channel members, a retired thread is push-safe only once frozen. Retiring first mutes everyone who loses access (channel-member `chat_level: 'none'`), and the freeze is then retried until it succeeds, recorded as `frozenAt`. It stays `updatePartial` with no system message.
- A beneficiary change starts that recipient's secret conversation from empty.
- Chat never feeds the activity feed or notifications.
