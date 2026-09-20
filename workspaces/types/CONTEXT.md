# Types

Shared contract vocabulary for `@prezentowo/types` — the method-args and document shapes both `workspaces/mobile` and `workspaces/backend` import.

## Language

**Many-to-many event**:
An event where every participant receives presents (Christmas, Secret Santa). `EventDoc.type` is `'many-to-many'`.

**Many-to-one event**:
An event where a single participant — the beneficiary — receives presents from everyone else (birthday, baby shower). `EventDoc.type` is `'many-to-one'`, paired with `beneficiaryParticipantId`.
_Avoid_: single-beneficiary event, one-person event

**Beneficiary**:
The one `EventParticipant` a many-to-one event's presents are for. Identified by `EventParticipant.id`, never a `userId` directly — a beneficiary can be a placeholder participant who has never created an account. The id is stable across a placeholder-to-real upgrade (`events.join`), so a beneficiary reference never needs updating when its placeholder is claimed.

**Recipient**:
The `EventParticipant` a single gift is for — `GiftDoc.forParticipantId`. Applies to every event kind: a many-to-many event gives each gift its own recipient (typically different per gift), while a many-to-one event's beneficiary is the recipient of every gift on that event.

**Self-added gift** / **Suggested gift**:
Whether a gift's recipient is also the one who added it (`GiftDoc.createdBy === recipient's userId`, self-added) or someone else added it for them (suggested). Mirrors the wireframes' "your own wishes" vs "Suggested by others" split (`3f`).

**Activity item**:
A record of a single, already-occurred event in an event's history — a gift added, a gift claimed, or a participant joining — surfaced to participants on Home, the event feed, and the event drawer. Chat messages and the live "how many presents have a buyer" count are not activity: chat lives entirely on GetStream, and the count is computed from gift data on read, never stored.
_Avoid_: notification, event log (ambiguous with `EventDoc`)

**Own-list visibility rule**:
The rule that a suggested gift is invisible to its recipient entirely, not merely stripped of fields — the recipient's own list only ever shows what they added themselves. Governs both a gift's own visibility and the visibility of any activity item reporting that a gift was added.

**Claim-quietly rule**:
The rule that a gift's claim state is always hidden from its recipient — self-added or suggested alike — so a recipient never learns who is buying their gift, or that it is being bought at all. Distinct from the own-list visibility rule: this one governs claim state, not the gift's existence, and applies even to gifts the recipient can see.
