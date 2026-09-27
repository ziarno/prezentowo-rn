# Offline is read-mostly: an encrypted mirror plus three queued writes

When offline, the app serves everything it last received from an `expo-sqlite` + SQLCipher cache, encrypted from the first write (`PRAGMA rekey` can't retrofit). Only `gifts.add`, `gifts.claim` and `gifts.unclaim` queue; every other write is disabled until the connection returns. On reconnect, the cache is replaced per subscription, never merged.

Mirroring exactly what the publications send means the server's visibility filters (the own-list visibility rule, the claim-quietly rule) already apply to the cache. A gift that becomes hidden simply disappears on the next replace. The three queued writes are the only ones safe to replay blind: claim/unclaim is `$addToSet`/`$pull`, and add is a pure creation (made idempotent with a `clientId`).

## Considered Options

- **An offline database product** (`ground:db`, `jam:offline`). Dead and browser-only respectively, and neither can load into React Native.
- **Full offline writes with conflict resolution.** Rejected. Edits, joins and event creation would need merge rules nothing in the product asks for.
- **An unencrypted cache.** Rejected. The cache holds who is buying what for whom, which is exactly what the visibility rules protect.

## Consequences

- The splash screen no longer waits for a live connection.
- Every write outside the three queued ones needs a visible disabled state while offline.
- The queue lives in the app-owned sync layer (ADR 0001), the only code that touches `@meteorrn/core`.
