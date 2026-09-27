# Stay on Meteor; own the sync layer above `@meteorrn/core`

The server stays on Meteor. This is a firm decision, not a "for now". Once the offline and web requirements were answered, the case for moving fell apart. Web became a single invite landing page, which Meteor serves fine. Offline became a read-mostly cache plus two queued writes, which is app-layer work on any platform. What moving would cost is the per-viewer publication filter (`gifts.byEvent` hides and strips gifts before they reach the person they're for), and every sync-platform alternative would have to rebuild it.

The defects that motivated the question all live in the mobile client `@meteorrn/core`, not the server. It stays pinned. We treat it strictly as the socket-and-protocol transport and don't expect upstream fixes: 1–2 maintainers, bursty releases, and the reconnect-wipe and login-resume issues are open upstream. A thin app-owned sync layer on top of it owns:

- reconnect handling (replace the cache per subscription)
- holding queued writes until login has resumed
- call timeouts
- the offline queue and the encrypted cache

It is the only code allowed to import `@meteorrn/core`.

## Considered Options

- **Move to a sync platform** (Convex, ElectricSQL, PowerSync, Zero/Replicache, InstantDB, RxDB, Firebase) or a hand-rolled WebSocket server. Rejected: it means re-solving "this viewer must not receive this document" and rebuilding working auth and methods. It's also a platform migration, which is a different effort from shipping the wireframed UX.
- **Move to Next.js.** Its one strong argument was serving the app, the API and the invite landing from one place. That went away when web was scoped to a landing page.
- **Replace the DDP client ourselves, or fork it now.** Rejected while a working client exists. No maintained alternative exists (`simpleddp` was last published in 2019).

## Consequences

- **Exit ramp:** if `@meteorrn/core` breaks on a future React Native release, vendor it into the repo. That's cheap because only the sync layer touches it. If upstream PR #174 (login-resume fix) merges, drop the matching part of our workaround.
- **No revisit is scheduled.** A future platform move would be a new effort, not a reopening of this one.
