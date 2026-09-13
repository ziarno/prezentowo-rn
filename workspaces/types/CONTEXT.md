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
