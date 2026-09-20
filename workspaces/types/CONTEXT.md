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
A record of a single, already-occurred event in an event's history — a gift added, a gift claimed, or a participant joining — surfaced to participants on Home, the event feed, and the event drawer. Chat messages and the live "how many presents have a buyer" count are not activity: chat lives entirely on GetStream, and the count is computed from gift data on read, never stored. Distinct from a **notification**: an activity item is shared and impersonal — everyone allowed to see one sees the same document — where a notification is personal to one account and carries its own read state.
_Avoid_: event log (ambiguous with `EventDoc`)

**Own-list visibility rule**:
The rule that a suggested gift is invisible to its recipient entirely, not merely stripped of fields — the recipient's own list only ever shows what they added themselves. Governs both a gift's own visibility and the visibility of any activity item reporting that a gift was added.

**Claim-quietly rule**:
The rule that a gift's claim state is always hidden from its recipient — self-added or suggested alike — so a recipient never learns who is buying their gift, or that it is being bought at all. Distinct from the own-list visibility rule: this one governs claim state, not the gift's existence, and applies even to gifts the recipient can see.

**`ImageRef`**:
The shape of `GiftDoc.image` (and `AddGiftArgs`/`UpdateGiftArgs`): a discriminated union, `{ kind: 'upload'; id } | { kind: 'illustration'; id }`. `'upload'` points at a self-hosted, session-authenticated upload with three fixed derivatives generated at upload time; `'illustration'` reuses today's bundled stock-illustration keys (e.g. `"p3"`). Carries no `provider` field — there is currently only one upload provider, so a discriminant with a single live value would be dead weight; add it back only if a second provider is ever introduced.

**Notification**:
An account-level record telling one user something they personally need to catch up on — distinct from an activity item, which is a per-event record the whole room can see. Keyed on `userId`, never `EventParticipant.id`, because the person being notified may not be a participant of the relevant event at all (someone who ignored an invite hasn't joined). Carries its own read/unread state and a `kind` discriminant, following the same denormalized-snapshot pattern as an activity item — but the two are separate collections, since a notification's per-viewer mutable state does not belong bolted onto an append-only shared log.

Three kinds exist. `invite-deferred`: the user opened an invite and chose Ignore rather than Join — self-inflicted, nobody sends it, and it's cleared on that user's later join to the event from any path. `suggestion-claimed`: someone claimed a gift this user suggested for someone else. It only fires for a suggested gift, never a self-added one — that exclusion at generation time, not a read-time filter, is what enforces the claim-quietly rule here: a recipient must never learn their own gift was claimed, and skipping generation for self-added gifts is the only thing standing between this notification and that leak. `participant-joined`: someone joined an event this user created, sent to the creator only — not every participant — so it doesn't double-report what the activity feed already shows.
_Avoid_: alert

**Link-import outcome**:
The three-way classification a shop-link-import attempt resolves to: **success** (full or partial — some field, such as price, may be structurally unresolvable — both route identically, since the present-creation summary makes every field editable regardless of origin); **unreadable** (the shop refused every request shape, or the URL wasn't a product page at all — one outcome, because the user's next action is the same either way); or an **infra failure** (the fetch itself failed, not the shop refusing it — kept distinct because it's plausibly transient and worth retrying, unlike the other two). Plausible *garbage* — a success that silently returns wrong values — is not a fourth outcome; it's undetectable at the moment it happens, so it's covered by an import review hint applied to every success, not a branch the UI can select on.

**Blocked shop list**:
A short, server-side allowlist-adjacent constant of shop domains confirmed **durably** unreadable (a contractual bar or a technical block confirmed to hold, not a fresh or unconfirmed one), checked before a link-import fetch is attempted so the caller gets shop-named messaging instead of the generic unreadable outcome. Deliberately excludes any shop whose block isn't yet confirmed durable — a shop's presence on the list is a claim about persistence, not just current state.

**Import review hint**:
A transient, client-only prompt on the present-creation summary, shown only during an import-originated session and never persisted to `GiftDoc` — reconciling with `ImageRef`'s sibling decision that an imported present carries no provenance field and must be indistinguishable from a typed one, forever, to everyone but its creator. Carries a field-specific note for any field the import structurally couldn't fill, plus a generic note covering the undetectable risk that a "successful" import returned wrong values.
