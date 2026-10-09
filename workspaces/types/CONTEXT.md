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

**Reserved placeholder**:
A placeholder participant created from a **people search** result in `4d` (`invitedUserId` set): it stands in for one specific Prezentowo user, the invitee, until they accept by joining, at which point they claim it and keep its id, exactly like any placeholder claim. Only the invitee can claim it, and nobody else sees it as claimable. It exists so that being found by name never makes someone a member of an event they didn't choose: until they join, they're a placeholder, and the event isn't on their Home. `invitedUserId` never leaves the server.
_Avoid_: pending participant

**Departed placeholder**:
What a deleted account's place in an event becomes: a placeholder that keeps the participant id, the name and the stock avatar the account had, and records the account's former userId (`departedUserId`). Their gifts, claims-on-them and activity stay attached through the id, and their own wishes stay told apart from suggestions through the former userId. Nobody can claim it. Otherwise it's like a placeholder added by name: the creator can remove it or give it a picture.
_Avoid_: deleted participant, ghost

**People search**:
Finding existing Prezentowo users by name in `4d` (`users.search`): a case- and diacritic-insensitive prefix match on any word of their name, returning only name, avatar and photo. Everyone with a name is findable.

**Avatar** / **Photo**:
How a user is pictured. Their **avatar** is a stock key (`f1`…`f12`, `m1`…`m12`) into avatars bundled with the app; their **photo** is an upload of their own (`profile.photo`, an upload id). The photo wins when set, else the avatar, else their initial. A user always keeps an avatar beside a photo, as its fallback and as what a **reserved placeholder** snapshots: an upload sits on one document only, so a reserved placeholder never carries a photo. A placeholder added by name is pictured the same way, with a stock avatar and a photo the event creator gives it; the photo is deleted when someone claims the placeholder.
_Avoid_: profile picture (the UI's word for whichever is shown)

**Recipient**:
The `EventParticipant` a single gift is for — `GiftDoc.forParticipantId`. Applies to every event kind: a many-to-many event gives each gift its own recipient (typically different per gift), while a many-to-one event's beneficiary is the recipient of every gift on that event.

**Self-added gift** / **Suggested gift**:
Whether a gift's recipient is also the one who added it (`GiftDoc.createdBy === recipient's userId`, or their `departedUserId` once they've deleted their account; self-added) or someone else added it for them (suggested). Mirrors the wireframes' "your own wishes" vs "Suggested by others" split (`3f`).

**Activity item**:
A record of a single, already-occurred event in an event's history — a gift added, a gift claimed, or a participant joining — surfaced to participants on Home, the event feed, and the event drawer. Chat messages and the live "how many presents have a buyer" count are not activity: chat lives entirely on GetStream, and the count is computed from gift data on read, never stored. Distinct from a **notification**: an activity item is shared and impersonal — everyone allowed to see one sees the same document — where a notification is personal to one account and carries its own read state.
_Avoid_: event log (ambiguous with `EventDoc`)

**Chat thread** / **Secret thread** / **Retired thread**:
A conversation on GetStream, recorded as a `ChatThreadDoc`. Each event has one event thread (`8b`) that every real participant is in, and one secret thread (`8a`) per real **recipient**, which every real participant except that recipient is in. When someone must lose access to a thread — a beneficiary change, or its recipient's removal — the thread is retired: it keeps its history on Stream but is never shown again, and a fresh thread replaces it where one is still needed.
_Avoid_: channel (that's the Stream object behind a thread)

**Own-list visibility rule**:
The rule that a suggested gift is invisible to its recipient entirely, not merely stripped of fields — the recipient's own list only ever shows what they added themselves. Governs both a gift's own visibility and the visibility of any activity item reporting that a gift was added.

**Claim-quietly rule**:
The rule that a gift's claim state is always hidden from its recipient — self-added or suggested alike — so a recipient never learns who is buying their gift, or that it is being bought at all. Distinct from the own-list visibility rule: this one governs claim state, not the gift's existence, and applies even to gifts the recipient can see.

**`ImageRef`**:
The shape of `GiftDoc.image` (and `AddGiftArgs`/`UpdateGiftArgs`): a discriminated union, `{ kind: 'upload'; id } | { kind: 'illustration'; id }`. `'upload'` points at a self-hosted, session-authenticated upload with three fixed derivatives generated at upload time; `'illustration'` points at **stock art** bundled in the app. The kind names where the bytes live, not what they depict. Carries no `provider` field — there is currently only one upload provider, so a discriminant with a single live value would be dead weight; add it back only if a second provider is ever introduced.

**Stock art**:
The images Prezentowo offers instead of an upload ("or use one of ours"): **present illustrations** for a gift's image, and **stock backgrounds** for an event's cover. It's always bundled with the app, never uploaded, and each piece has a permanent id: a letter for its role (`p` for presents, `b` for backgrounds) plus a number that is never reused.

**Fallback art**:
The stock art shown when a gift or event has no image (or one this version of the app doesn't have). It's picked from the gift's or event's identity, so it always looks the same for that gift or event, but it isn't stored. The field stays empty, and "no image chosen" stays distinguishable from a chosen one.

**Notification**:
An account-level record telling one user something they personally need to catch up on — distinct from an activity item, which is a per-event record the whole room can see. Keyed on `userId`, never `EventParticipant.id`, because the person being notified may not be a participant of the relevant event at all (someone who ignored an invite hasn't joined). Carries its own read/unread state and a `kind` discriminant, following the same denormalized-snapshot pattern as an activity item — but the two are separate collections, since a notification's per-viewer mutable state does not belong bolted onto an append-only shared log.

Six kinds exist. `invite-deferred`: the user opened an invite and chose Ignore rather than Join — self-inflicted, nobody sends it, and it's cleared on that user's later join to the event from any path. `invited`: an event's creator added this user as a reserved placeholder. It's cleared when they join, or when the creator removes the reservation; ignoring it leaves it in place, since there's no decline. `suggestion-claimed`: someone claimed a gift this user suggested for someone else. It only fires for a suggested gift, never a self-added one — that exclusion at generation time, not a read-time filter, is what enforces the claim-quietly rule here: a recipient must never learn their own gift was claimed, and skipping generation for self-added gifts is the only thing standing between this notification and that leak. `participant-joined`: someone joined an event this user created, sent to the creator only — not every participant — so it doesn't double-report what the activity feed already shows. `claimed-gift-removed`: a gift this user had claimed was deleted by its creator or the event creator — they may already have bought it. Sent to every claimer except the deleter, never naming who deleted it; a gift removed as a side effect of removing its recipient from the event sends nothing. `event-handed-over`: this user is now the creator of an event, because its creator deleted their account and they were the earliest-joined remaining member. It never pushes.
_Avoid_: alert

**Push**:
A notification, or a chat message, delivered to a device through the operating system so it reaches someone outside the app. A push is only ever a second delivery of something that already exists: every inbox push mirrors one notification and never says more than that notification does, so the inbox's rules (above all claim-quietly) hold for push too. `invite-deferred` is never pushed, because the user created it themselves. Chat messages are pushed by GetStream, not by Prezentowo.
_Avoid_: notification (on its own, that means the inbox record)

**Push token**:
One device's address for push, bound to at most one account at a time. Registering it from another account takes it away from the first one. It carries that device's language, so push text is written in the language the device shows.

**Push preference**:
A user's on/off switch for pushing one kind (or chat messages), stored on the account, so it follows them to every device. Anything they haven't set counts as on: the operating system's permission prompt is the real opt-in. Turning a kind off stops the push only. The notification still lands in the inbox.

**Profile stats**:
The three counts on a user's own Profile, all counted from what exists now, never kept as running totals, so a number can go down when an event or gift is deleted. **Events**: every event they're a full member of, past and upcoming, which is the list Home shows; an invitation they haven't accepted doesn't count. **Wished**: their **self-added gifts** across those events. Suggested gifts are left out, because counting them would reveal that they exist (the own-list visibility rule). **Claimed**: the gifts they're among the claimers of, across those events.
_Avoid_: Given (the wireframe's label; a claim doesn't mean it's been given)

**Link-import outcome**:
The three-way classification a shop-link-import attempt resolves to: **success** (full or partial — some field, such as price, may be structurally unresolvable — both route identically, since the present-creation summary makes every field editable regardless of origin); **unreadable** (the shop refused every request shape, or the URL wasn't a product page at all — one outcome, because the user's next action is the same either way); or an **infra failure** (the fetch itself failed, not the shop refusing it — kept distinct because it's plausibly transient and worth retrying, unlike the other two). Plausible *garbage* — a success that silently returns wrong values — is not a fourth outcome; it's undetectable at the moment it happens, so it's covered by an import review hint applied to every success, not a branch the UI can select on.

**Blocked shop list**:
A short, server-side allowlist-adjacent constant of shop domains confirmed **durably** unreadable (a contractual bar or a technical block confirmed to hold, not a fresh or unconfirmed one), checked before a link-import fetch is attempted so the caller gets shop-named messaging instead of the generic unreadable outcome. Deliberately excludes any shop whose block isn't yet confirmed durable — a shop's presence on the list is a claim about persistence, not just current state.

**Import review hint**:
A transient, client-only prompt on the present-creation summary, shown only during an import-originated session and never persisted to `GiftDoc` — reconciling with `ImageRef`'s sibling decision that an imported present carries no provenance field and must be indistinguishable from a typed one, forever, to everyone but its creator. Carries a field-specific note for any field the import structurally couldn't fill, plus a generic note covering the undetectable risk that a "successful" import returned wrong values.
