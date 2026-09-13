# AGENTS.md

## What is repo

Yarn v1 workspace. Three parts:
- `workspaces/mobile` — Expo app
- `workspaces/backend` — Meteor server (port `8100`)
- `workspaces/types` — shared TS types. Import as `@prezentowo/types`

Root `yarn dev` starts both via `mprocs`. Root `lint` = mobile only. No root test or typecheck.

Mobile runs as a **development build**, not Expo Go — see [Running the mobile app](#running-the-mobile-app).

## Commands

```
yarn dev                                  # start everything
yarn workspace mobile ios                 # build + install the dev client on an iOS simulator (first run / native deps changed)
yarn workspace mobile android             # same, for an Android emulator
yarn workspace mobile start               # Metro only — needs a dev client already installed (see below)
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

### Running the mobile app

`expo-dev-client` is a dependency, so Expo Go cannot run this app — `yarn workspace mobile start` alone opens a dev-client pairing screen, not a working app, until a dev client build is on the device.

- **First run, or after a native dependency changes** (any `expo-*` package, `app.json` plugin list, or anything else that touches native code): `yarn workspace mobile ios` / `yarn workspace mobile android`. This runs Expo's Continuous Native Generation (`ios/` and `android/` are generated on demand, gitignored, never committed), builds the native project locally, installs it on a simulator/emulator or connected device, and starts Metro.
- **Day to day**, once that build is installed: `yarn workspace mobile start` reuses it — Metro-only, no native rebuild.
- No EAS project is configured; this is a **local** dev build (`expo run:ios` / `expo run:android` under the hood). Needs Xcode + a simulator (or Android Studio + an emulator/device) on the machine running it.
- The app blocks on its splash screen until it has a live DDP connection to the backend (see `src/ui/SplashScreenController.tsx`) — start `yarn workspace backend start` (or root `yarn dev`) too, or the UI never appears past the splash.
- `expo-env.d.ts` (ambient types for `expo/types`, needed for the `global.css` side-effect import to typecheck) is gitignored and only written the first time the dev server or a native build runs in a given checkout/worktree — run `yarn workspace mobile start` (or `ios`/`android`) once before `tsc --noEmit` on a fresh checkout.

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
- `workspaces/mobile/app.json` has Expo Router typed routes and React Compiler experiment enabled — both still under `experiments`, unchanged in shape across the Expo 56→57 upgrade
- Expo SDK 57 / React Native 0.86.3. New Architecture is the only architecture (RN removed the old one; there is no `newArchEnabled` toggle to set). No `ios/`/`android/` folders are committed — they're generated on demand, see [Running the mobile app](#running-the-mobile-app)
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
