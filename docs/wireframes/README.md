# Prezentowo wireframes — screen inventory

**This file is derived, not authoritative.** The canvas is the editable source
of truth: [Claude Design project `d4e1d229`](https://claude.ai/design/p/d4e1d229-1904-4534-8911-808abf57c30a?file=Prezentowo+Wireframes.dc.html),
file `Prezentowo Wireframes.dc.html`. Low-fidelity wireframes — layout and flow
are specified, visual styling is not.

**Captured 2026-09-11.** If the canvas has been edited since, this inventory is
stale and should be re-derived before it is trusted for anything load-bearing.
It lives in the repo because reading the canvas needs interactive auth
(`/design-login`), which agent sessions and CI do not have — so this is the copy
tickets can actually reference.

Screen ids (`3a`, `5c`, …) are the wireframe's own and are stable. Use them when
referring to a screen in issues and PRs.

## 1. Home & navigating an event (`t3`)

Events are the **only** container for presents — there is no separate list
concept. Navigation is a **hamburger drawer** whose contents are contextual: on
Home it holds your profile and settings; inside an event it holds `← Home`,
`✎ Edit event`, `Activity`, `Chat`, and the people.

Tapping a person opens their presents. **Your own view shows only what you
added**; another person's shows everything, marked by who added it.

| Id | Screen |
| --- | --- |
| `3a` | Home — events list, each row with up to 3 recent activity items, date + countdown + `many-to-one`/`many-to-many` badge, `＋` FAB |
| `3b` | Home drawer — event shortcuts, profile (name + email), Notifications, Dark mode toggle, Language, Privacy & visibility, Sign out |
| `3c` | Event feed (many-to-one) — large event cover, title, date, countdown, people count, Activity list |
| `3c3` | Event feed scrolled — cover collapses to a compact header, stays that size |
| `3c2` | Event feed (many-to-many) — same shape, activity mentions "for <person>" |
| `3c4` | Event feed (many-to-many) scrolled |
| `3d` | Event drawer, many-to-many — `← Home`, `✎ Edit event`, `Activity`, `Chat`, Participants each with a present count, `＋ Invite people` |
| `3d2` | Event drawer, many-to-one — one beneficiary with a present count, the rest listed as participants **without** counts |
| `3e` | A person's presents — **yourself**: only the presents you added. Banner: "You only see what you added. Presents others suggested — and who is buying — stay hidden." |
| `3f` | A person's presents — **someone else**: a chat recap box with a `💬 Chat` button, then two groups — "**<name>'s own wishes**" and "**Suggested by others**" (marked "<name> never sees this group — or any buyers"). Each present shows `🛍` buyer chips, possibly several. |

## 2. Creating an event (`t4`)

Four steps, progress bar, `Back` / `Next` at the bottom. Many-to-one events get
**one extra step** after participants.

| Id | Screen |
| --- | --- |
| `4a` | Step 1 — name & date. "The date drives the countdown on Home." |
| `4b` | Step 2 — event type: *Everyone gets presents* (Christmas, Secret Santa) vs *One person gets presents* (birthday, baby shower) |
| `4c` | Step 3 — background: upload a photo, or pick one of ours. Sits behind the event header (`3c`) |
| `4d` | Step 4 — participants: search Prezentowo **or type a name**. Existing users and **placeholder people "added by name"**. "Anyone can also join later with an invite link — no approval needed." |
| `4e` | Extra step, many-to-one only — who is the event for? Pick from the participants added |

## 3. Editing an event (`t6`)

| Id | Screen |
| --- | --- |
| `6a` | One screen holding everything creation set, each row leading back to that step. Background, name, date, event type (**shown but locked once presents exist**), participants, **invite link** (`prezentowo.jarno.pl/e/x7k2` + copy). `Delete event` at the bottom, separated — **creator only**. |

## 4. Being invited (`t7`)

| Id | Screen |
| --- | --- |
| `7a` | Invite — who invited you, event date + countdown, who is already taking part. "Joining shows your name to everyone in the event." `Ignore` returns Home and **the invite stays in notifications**; `Join event` enters the event. |

## 5. Adding a present (`t5`)

Three steps, then a review. Every path ends on the **same summary**, where each
field — including the name — can be edited before saving. "That matters most for
imported presents, where the data came from a shop rather than from the person."

| Id | Screen |
| --- | --- |
| `5a` | Step 1 — name input, **or** below an "or": `🔗 Create from link` (paste a shop URL, we fill in the rest) and `📷 Create from barcode` (scan the product in a shop). Both **jump straight to the summary** with fields prefilled. |
| `5b` | Step 2 — photo: upload from gallery/camera, or pick one of ours. **One photo per present.** Skippable. |
| `5c` | Step 3 — optional description and link. Both may be empty. |
| `5d` | Summary — every field editable in place, then `Add present` |

No price field in the flow (the canvas lists "add a price field" as an untaken
next step).

## 6. Present detail (`t1`)

| Id | Screen |
| --- | --- |
| `1e` | Photo, tags for who it is **for**, who **added** it, and `🛍` chips for **each** buyer; then description and link. `I'll buy this too` action — buying is **not exclusive**. Coordination happens in the chat threads (`8a`), not here. |

## 7. Chats (`t8`)

**Two threads per event**, both opened from the drawer or from a person's
presents, and both **the only place messages are written**.

| Id | Screen |
| --- | --- |
| `8a` | Person's presents thread — **hidden from that person**, so buyers can coordinate on presents others suggested |
| `8b` | Event chat — visible to everyone in the event. "only talk about presents people added for themselves" |

Present cards show a **chat recap box with a `Chat` button only** — no inline
message input; the recap pushes users to the fullscreen thread to write.

## Design system

The canvas imports `_ds/filip-s-design-2-…/_ds_bundle.css` (`styles.css` is just
an `@import` of it). That bundle is **`prezentowo-ui` — the visual language
extracted from the *legacy* Prezentowo web app** (Semantic UI + LESS,
`client/styles/partials/vars.import.less`): brand green `#3c8d0d` / `#245508`,
greys, `.pz-*` component classes, Lato.

This **does not match** the current React Native app, which uses the warm
"garland" palette (`workspaces/mobile/src/constants/colors.ts`: paper `#fffaf2`,
ink `#1d1a14`, green `#2f5b3a`, amber, berry) with the FoglihtenNo07 display
font. Which visual language wins is an open decision, not something the
wireframes settle.
