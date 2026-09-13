# AGENTS.md

## What is repo

Yarn v1 workspace. Three parts:
- `workspaces/mobile` — Expo app
- `workspaces/backend` — Meteor server (port `8100`)
- `workspaces/types` — shared TS types. Import as `@prezentowo/types`

Root `yarn dev` starts both via `mprocs`. Root `lint` = mobile only. No root test or typecheck.

## Commands

```
yarn dev                                  # start everything
yarn workspace mobile start               # mobile only
yarn workspace backend start              # backend only
yarn lint                                 # mobile lint
yarn workspace mobile lint                # also mobile lint
yarn format                               # format all
yarn workspace mobile format              # format mobile
yarn workspace backend format             # format backend
yarn workspace backend test               # backend tests
yarn workspace backend test-app           # backend full-app watch tests
yarn workspace mobile tsc --noEmit        # mobile type check (not scripted)
yarn workspace backend tsc --noEmit       # backend type check (not scripted)
```

## Mobile wiring

- Router entry: `workspaces/mobile/src/app` — NOT default `app/`
- Route guards: `workspaces/mobile/src/app/_layout.tsx`
- Authenticated stack: `workspaces/mobile/src/app/(app)/*`
- Modal vs push: `workspaces/mobile/src/app/(app)/_layout.tsx`
- `@/*` alias maps to both `./src/*` and `./*` — see `workspaces/mobile/tsconfig.json` and `babel.config.js`
- DDP connects at module load: `workspaces/mobile/src/hooks/useConnection.ts` using `workspaces/mobile/config.json`
- Auth/onboarding stored in Expo SecureStore
- Mobile talks to Meteor via `@meteorrn/core`, `ddp.sub`, and `Mongo.Collection` in `workspaces/mobile/src/api/*`

## Meteor / types quirks

- Backend entry: `workspaces/backend/server/main.ts` → loads via `workspaces/backend/imports/startup/main-server.ts`
- Meteor types: `tsconfig.json` maps `meteor/*` to `@types/meteor` and `.meteor/local/types/packages.d.ts`
- Mobile has shim at `workspaces/mobile/meteorrn-core.d.ts`
- Mobile has patch at `workspaces/mobile/patches/@meteorrn+core+2.9.1.patch` — DO NOT remove or bypass when touching `@meteorrn/core` types
- Shared contracts: `workspaces/types/src/index.ts` — update BEFORE changing method/publication payloads on both sides

## Style traps

- Mobile lint = `expo lint` with Prettier warnings from `workspaces/mobile/eslint.config.js` — formatting errors come through ESLint
- NativeWind: wired via Metro + `global.css`. Gluestack UI wrapped at root in `workspaces/mobile/src/app/_layout.tsx`
- `workspaces/mobile/app.json` has Expo Router typed routes and React Compiler experiment enabled
- MCP: `.mcp.json` has `gluestack` (in-project) only. Meteor docs come from Context7, not a local server.
- Use Context7 **`/websites/meteor`** for Meteor docs — it tracks live docs.meteor.com and is correct on Meteor 3 semantics.
- **Never use Context7 `/meteor/docs`.** It serves the Meteor 2 docs repo and is wrong on `WebApp` (documents the Connect-era `WebApp.connectHandlers`/`handlers` split backwards; Meteor 3 is Express, and the two names are aliases for the same object).
- Context7 cannot be version-pinned to a Meteor 3 release, so it always tracks latest and can volunteer APIs newer than our pin. Confirm any load-bearing API actually exists in our release against `meteor/meteor` at `release-3.5` and `workspaces/backend/.meteor/packages` before designing on it.

## Verify before done

- Mobile edit → `yarn workspace mobile lint` → `yarn workspace mobile tsc --noEmit` if types touched
- Backend edit → `yarn workspace backend tsc --noEmit` → `yarn workspace backend test`
- Shared types / API contract → verify BOTH workspaces. Root scripts won't do it for you.

## Agent skills

### Issue tracker

GitHub Issues via the `gh` CLI (repo: `ziarno/prezentowo-rn`, inferred automatically by `gh`). See [docs/agents/issue-tracker.md](docs/agents/issue-tracker.md).

### Triage labels

Default five canonical role labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See [docs/agents/triage-labels.md](docs/agents/triage-labels.md).

### Domain docs

Multi-context layout: root `CONTEXT-MAP.md` + per-workspace `CONTEXT.md`/`docs/adr/` under `workspaces/mobile`, `workspaces/backend`, `workspaces/types`. See [docs/agents/domain.md](docs/agents/domain.md).
