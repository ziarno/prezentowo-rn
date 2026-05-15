# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Commands

**From repo root:**
```bash
yarn install       # Install all workspace dependencies
yarn mobile        # Start mobile app (Expo dev server)
yarn backend       # Start Meteor backend
yarn lint          # Lint mobile app code
yarn format        # Format mobile + backend code
```

**Mobile-specific (from `mobile/`):**
```bash
yarn start         # Start Expo dev server
yarn ios           # Run on iOS simulator
yarn android       # Run on Android emulator
yarn web           # Run web app
```

**Backend-specific (from `backend/`):**
```bash
yarn start         # Start Meteor on port 8100 with settings.json
yarn test          # Run tests once
```

## Architecture

This is a monorepo with three workspaces:
- `mobile/` — React Native/Expo mobile client
- `backend/` — Meteor.js server
- `packages/types/` — Shared TypeScript types (e.g. `RegisterNewUserArgs`, `LoginCredentials`)

### Mobile App (`mobile/`)

**Routing**: Expo Router with file-based routes in `src/app/`:
- `_layout.tsx` — Root layout; uses `Stack.Protected` to guard routes based on auth state
- `(app)/` — Protected drawer navigation group (home + profile)
- `login.tsx` / `register.tsx` — Public screens

**UI components** live in two places:
- `src/components/screens/` — Full screen components (e.g. `LoginScreen.tsx`)
- `components/ui/` — Gluestack UI component wrappers (button, input, text, etc.)

**State**: Zustand store in `src/store/useAuthStore.ts` holds `isLoading` and `userToken`.

**Auth logic**: `src/hooks/useAuth.ts` wraps Meteor login/logout/register calls and writes to the store. `src/hooks/useConnection.ts` initializes the Meteor WebSocket connection.

**Styling**: NativeWind (Tailwind CSS for React Native). Custom color tokens and shadows are defined in `tailwind.config.js`. Use Tailwind class names on components.

**Forms**: Formik + Yup validation.

**Backend connection**: Configured via `config.json` (WebSocket URL, e.g. `ws://192.168.1.207:8100/websocket`). Uses `@meteorrn/core` for DDP.

**Path alias**: `@/*` maps to `src/*` (and `./` for assets).

### Backend (`backend/`)

Meteor.js app running on port 8100 with TypeScript. Key structure:
- `imports/api/accounts/accounts.methods.ts` — Meteor methods: `registerNewUser`, `updateUser`
- `imports/startup/server/accounts.config.ts` — Accounts system configuration
- Requires `settings.json` at startup (passed via `--settings settings.json`)

Shared types between app and backend come from `packages/types/`.
