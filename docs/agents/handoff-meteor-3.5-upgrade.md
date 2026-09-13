# Handoff — Meteor 3.5.2 upgrade + remove the local Meteor MCP server

**Written:** 2026-09-12. **Status:** research done, nothing implemented, nothing committed.

## Goal

Two changes, landed together:

1. Upgrade `workspaces/backend` from `METEOR@3.4` to `METEOR@3.5.2` (latest stable).
2. **Delete** the `workspaces/mcp-meteor` MCP server completely, and rewrite the Meteor-docs
   guidance in `AGENTS.md` to point at Context7 instead.

They go together deliberately: the local server is pinned to 3.4, so removing it *before* the
upgrade would leave agents reading live 3.5 docs against a 3.4 backend — the exact version drift
that caused this work. Don't split them across PRs.

---

## READ THIS FIRST — where the work lives

| | |
|---|---|
| Worktree | `/Users/jarno/dev/prezentowo-rn/.claude/worktrees/silly-wing-7212c5` |
| Branch | `claude/silly-wing-7212c5` |
| Commits on branch | **none** — branch is still at `726a3de`, same as `main` |
| State | **all work is uncommitted** |

**Consequences you must respect:**

- **Work in that exact worktree.** The changes below exist only in its working tree. If you spawn a
  fresh worktree off `main` or off `claude/silly-wing-7212c5`, you will see *none* of it, because
  nothing has been committed. Either `cd` to the path above, or ask the user to commit first.
- **Do not `cd` to `/Users/jarno/dev/prezentowo-rn`** (the main checkout). Run everything from the
  worktree path.
- **Never use bare `git stash` / `git stash pop`.** The stash stack is shared across all worktrees
  and other sessions may be using it. Prefer a temporary WIP commit. If you must stash, use
  `git stash push -u -m "<unique-tag>"`, capture the SHA, and restore with `git stash apply <sha>`.
- The `workspaces/mcp-meteor` submodule **is initialized in this worktree** (with a `.venv`) and its
  working tree is **intentionally dirty** (3 patched files). A fresh worktree would have it empty.
  All of this is about to be deleted anyway — see step 2.

## Current uncommitted changes, and what to do with each

```
 M .gitmodules                              # added `ignore = dirty` for the submodule
 M AGENTS.md                                # corrected MCP description + 3-way doc-source guidance
A  patches/meteor-mcp-webapp-express.patch  # (staged) content fix for the MCP server
 M scripts/setup-meteor-mcp.sh              # applies the patch after submodule init
```

Plus, inside the submodule: `data/webapp.py`, `data/examples.py`, `data/assets.py` modified.

These fix a real bug (below) **for a 3.4 world we're about to leave**. The user decided not to commit
them, to avoid landing work that the next commit deletes.

- `patches/…`, `scripts/setup-meteor-mcp.sh`, `.gitmodules` → **delete as part of step 2.**
- `AGENTS.md` → **keep the substance, rewrite it.** The `/meteor/docs` warning is still live and
  valuable. See step 2.
- **Fallback:** if the upgrade is abandoned (e.g. rspack proves too painful and you stay on 3.4),
  these four files are the correct outcome — commit them as-is instead, and skip step 2 entirely.

---

## Verified facts — do not re-research these

All confirmed against primary sources on 2026-09-12.

**The original bug (why the patch exists).** The MCP server's `WebApp` docs were wrong in two ways:
it named `WebApp.connectHandlers` as canonical with `handlers` as the back-compat alias (backwards),
and described the stack as Connect, typing both as `connect.Server`.

Truth, from `meteor/meteor@release-3.4` `packages/webapp/webapp_server.js`:

```js
import express from 'express';   // L8
const app = express();           // L27
WebApp.express = express;        // L49
Object.assign(WebApp, {          // L1360
  connectHandlers: packageAndAppHandlers,
  handlers:        packageAndAppHandlers,   // same object — aliases
  rawConnectHandlers: rawExpressHandlers,
  rawHandlers:        rawExpressHandlers,
  httpServer, expressApp: app,
```

`packages/webapp/package.js` pins `express: "5.1.0"`. Per the
[3.0 migration guide](https://v3-migration-docs.meteor.com/breaking-changes/): `connectHandlers` →
`handlers`, `rawConnectHandlers` → `rawHandlers`, `connectApp` → `expressApp` (the last is already
gone in 3.4). Because the two names are the *same object*, this was wrong guidance, not a runtime
trap — code written from it still ran.

**It was not a version-pin problem.** The rest of that server's corpus is correctly Meteor 3 (Fibers
documented as removed, full async surface). Isolated authoring error in one module.

**There was no upgrade available for the MCP server.** `apitlekays/meteor-mcp` is a third-party
submodule, we have `READ` permission, our pin *is* the tip of `origin/main` (0 behind), no tags or
releases, last commit 2026-02-24, zero PRs and zero issues ever. Patching was the only route.

**Context7 doc sources disagree — this trap is still live after the upgrade:**

- `/websites/meteor` — live docs.meteor.com. **Correct**; use this.
- `/meteor/docs` — serves the **Meteor 2** docs repo and repeats the identical
  `WebApp.connectHandlers`/Connect error. **Never use.** Note `resolve-library-id` lists it first,
  so it is the easy wrong pick.
- `/meteor/meteor` — only version-pinned option, and only at `METEOR@2.5.1`. Useless.

Context7 **cannot be version-pinned** to a Meteor 3 release, so it always tracks latest and will
drift ahead of us again once 3.6 ships.

**Versions.** Latest stable is **3.5.2**. `3.6` exists only as `3.6-beta.0`, tagged 2026-09-10 — do
**not** target it. Real release branch dates: 3.3 Jun 2025, 3.4 Jan 2026, 3.5 Jun 2026 — roughly
5–7 months per minor.

**Mongo is not a blocker.** 3.5 makes Change Streams the default, requiring MongoDB 6+ as a replica
set or sharded cluster. There is **no production Mongo** (app is early-stage), and Meteor's bundled
dev Mongo is **7.0.16** started with `--replSet meteor` (a single-node replica set) — identical in
3.4 and 3.5.2. Works out of the box.

**What 3.5 actually buys us:** `accounts-express@1.0.0` (authenticated REST endpoints where
`Meteor.userId()`/`Meteor.user()` work inside the handler — this is the real motivation, it is
purpose-built for ticket #5), DDP session resumption (short disconnects skip full re-subscribe —
valuable for the RN client), and async login helpers.

---

## Plan

### Step 1 — Upgrade to 3.5.2

```bash
cd /Users/jarno/dev/prezentowo-rn/.claude/worktrees/silly-wing-7212c5/workspaces/backend
meteor update --release 3.5.2
```

**Expect the rspack bump to be the only real work.** `.meteor/packages` pins `rspack@1.0.0`; 3.5.2
ships `rspack@1.3.0`, and the npm-side `@meteorjs/rspack` moves **v1.x → v2.x**.
`workspaces/backend/rspack.config.ts` imports `defineConfig` from `@meteorjs/rspack` and uses
`ts-checker-rspack-plugin` — both may need updating, and the plugin's peer range may not yet allow
v2. Meteor still has dedicated `release-3.5.2-rspack*` branches, i.e. this area is not fully settled.
The 3.5.1 notes say to run `meteor update --release 3.5.1` then `meteor run` to pick up compatible
versions; do the equivalent for 3.5.2.

Also check `mongo` package `2.2.0` → `2.5.1`.

### Step 2 — Remove the MCP server completely

"Remove" means remove; nothing is retained.

> **⚠️ Do NOT `rm -rf` the submodule's git dir.** `git rev-parse --git-common-dir` resolves to
> `/Users/jarno/dev/prezentowo-rn/.git`, which is **shared with the main checkout**, and
> `.git/modules/workspaces/mcp-meteor` there belongs to the main checkout — whose `mcp-meteor`
> submodule is currently populated and in use. Deleting it breaks the main checkout. `deinit` +
> `git rm` is all that's needed to remove it from the branch; leave the shared gitdir alone. The
> user can clean it up from the main checkout after this merges.

```bash
cd /Users/jarno/dev/prezentowo-rn/.claude/worktrees/silly-wing-7212c5
git submodule deinit -f workspaces/mcp-meteor
git rm -f workspaces/mcp-meteor
rm -f scripts/setup-meteor-mcp.sh patches/meteor-mcp-webapp-express.patch
rmdir patches 2>/dev/null || true
```

Then:
- **Remove the `postinstall` hook from the root `package.json`.** It is currently
  `"postinstall": "bash scripts/setup-meteor-mcp.sh"` — deleting the script without removing this
  **breaks `yarn install` for everyone.** Do not skip this.
- Remove the `[submodule "workspaces/mcp-meteor"]` block from `.gitmodules` (delete the file if it
  becomes empty — it currently contains only that block, plus the `ignore = dirty` line added this
  session).
- Remove the `meteor` server from `.mcp.json` (leave `gluestack` alone).
- Rewrite the `AGENTS.md` block (currently around lines 53–60, added this session). It should reduce
  to roughly: use Context7 **`/websites/meteor`** for Meteor docs; **never `/meteor/docs`** (Meteor 2
  content, wrong on `WebApp`); confirm any load-bearing API exists in our release against
  `meteor/meteor` at `release-3.5` and `workspaces/backend/.meteor/packages`. Drop all references to
  `workspaces/mcp-meteor`, the patch, and the setup script.

### Step 3 — Verify

There is **no safety net**: `workspaces/backend/tests/` contains only `main.ts`, there are **zero**
test/spec files, and there are **no CI workflows**. `yarn workspace backend test` passes vacuously.
So "it works" means, concretely:

```bash
yarn install                          # must succeed with the postinstall hook removed
yarn workspace backend tsc --noEmit
yarn workspace backend start          # boots on :8100
yarn workspace mobile start           # DDP connects (src/hooks/useConnection.ts, config.json)
yarn workspace mobile tsc --noEmit    # meteorrn-core.d.ts + the @meteorrn/core patch still apply
yarn lint
```

Confirm the mobile client actually connects and a publication delivers data — that is the real
check that DDP/change-streams behave. The `@meteorrn/core` patch is `.d.ts`-only, so runtime risk
there is low, but don't remove or bypass it (see `AGENTS.md`).

If you want a real net before starting, add a couple of method/publication tests **first** — the
backend is only 13 TS files, so this is cheap. The user chose to skip this given the app is
pre-production; raise it again only if rspack turns messy.

### Step 4 — Out of scope here

Ticket #5 (authenticated HTTP upload endpoints) on `accounts-express`. Separate piece of work; do
not fold it into the upgrade PR.

---

## Don'ts

- Don't target `3.6` — beta only.
- Don't commit the four existing files as-is unless the upgrade is abandoned (see above).
- Don't use Context7 `/meteor/docs`, and don't trust the MCP server's `WebApp` content if you
  somehow still have it running — that's the bug that started this.
- Don't `cd` to the main checkout, and don't use bare `git stash`.
- Don't push, open a PR, or contact the third-party upstream without asking the user. An upstream
  PR to `apitlekays/meteor-mcp` was discussed and explicitly left unactioned; it's moot once the
  submodule is deleted.
