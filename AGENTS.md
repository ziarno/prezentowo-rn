# AGENTS.md

This file provides guidance when working with code in this repository.

## Best practices

- this project uses the React Compiler — do NOT add manual memoization (`useMemo`, `useCallback`, `React.memo`)
- prefer one component per file — give each component its own file rather than defining several in one
- create shared jsx components to reduce code duplication
- run `tsc --noEmit` after you're done editing code to check any typescript errors
- every pressable component should have a visible feedback
- prefer icons from `@/components/ui/icon` over custom inline SVGs — add new icons there
- use `GarlandButton` / `GarlandField` / `AuthField` for buttons and inputs; don't re-style raw Pressable + TextInput
- keep design tokens (colors, fonts) and reusable data (avatars, sample fixtures) under `src/constants/`

## Useful commands

**From repo root:**
```bash
yarn lint          # Lint mobile app code
yarn format        # Format mobile + backend code
```

## Architecture

This is a monorepo with workspaces under `workspaces/`:
- `workspaces/mobile/` — React Native/Expo mobile client
- `workspaces/backend/` — Meteor.js server
- `workspaces/types/` — Shared TypeScript types (e.g. `RegisterNewUserArgs`, `LoginCredentials`)
- `workspaces/mcp-meteor/` — Meteor MCP server (git submodule)

### Mobile App (`workspaces/mobile/`)

**glustack-ui**
- the mobile app uses the gluestack-ui as component library. Try to use its components instead of creating your own.
- gluestack-ui components are downloadable components. They are downloaded into mobile/src/components/ui. Don't edit them.

**Routing**: Expo Router with file-based routes in `src/app/`:
- `_layout.tsx` — Root layout; uses `Stack.Protected` to guard routes based on auth state (`onboarding` → `welcome`/`signin`/`check-email` → `first-login` → `(app)`)
- `(app)/_layout.tsx` — Stack navigator (not a drawer) with `headerShown: false` globally; screens own their own chrome
- `(app)/index.tsx` — Events home
- `(app)/create-event.tsx` — modal presentation
- `(app)/join-event.tsx` — invite-accept flow; supports `?preview=signed-out`
- `(app)/profile.tsx` — profile/settings
- `welcome.tsx` / `signin.tsx` / `check-email.tsx` / `first-login.tsx` — public/auth screens
- Note: typed routes from Expo Router are regenerated when the dev server runs; if `.expo/types/router.d.ts` is stale, restart `yarn mobile`

**UI components**:
- `src/ui/screens/` — full screen components (e.g. `EventsScreen.tsx`, `CreateEventScreen.tsx`)
- `src/ui/components/` — app-specific shared building blocks (`GarlandButton`, `GarlandField`, `AuthField`, `Avatar`/`AvatarStack`, `LanguageToggle`, `OnboardingIllustration`)
- `components/ui/` — Gluestack UI primitives copied into the project (button, input, text, icon, fab, vstack, gluestack-ui-provider)
- `components/ui/icon/index.tsx` — single source of truth for icons. Each icon is a small `react-native-svg` component that takes `{ width, height, color }`. Add new icons here.

**Constants** (`src/constants/`):
- `colors.ts` — `garland` palette (paper, ink, ink60/40/15/08, green, amber, berry, moss). Mirror any additions in `tailwind.config.js` under `colors.garland.*`.
- `fonts.ts` — display font family name
- `avatars.ts` — `AVATAR_SOURCES`, `AVATAR_KEYS`, `AvatarKey`, `avatar(key)` helper
- `sampleData.ts` — fixture events/participants used by the mocked screens

**State**: Zustand store in `src/store/useAuthStore.ts` (`userToken`, `hasCompletedOnboarding`, `firstLoginPending`, `pendingEmail`).

**Auth logic**: `src/hooks/useAuth.ts` wraps Meteor login/logout/register calls and writes to the store. `src/hooks/useConnection.ts` initializes the Meteor WebSocket connection. `src/hooks/useMagicLinkDeepLink.ts` handles passwordless deep-link entry.

**Styling**: NativeWind (Tailwind CSS for React Native). Custom color tokens, fonts, and shadows are defined in `tailwind.config.js`. Use Tailwind class names on components. The Garland palette is also exposed as JS tokens via `@/constants/colors` for non-className use (e.g. shadow color, SVG fills).

**Forms**: Formik + Yup validation. See `CreateEventScreen.tsx` for an end-to-end example with field-level errors, dynamic array fields (participants), and a separate `useState`-backed text input feeding into the array.

**Backend connection**: Configured via `config.json` (WebSocket URL, e.g. `ws://192.168.1.207:8100/websocket`). Uses `@meteorrn/core` for DDP.

**Path aliases** (`tsconfig.json` + `babel.config.js`):
- `@/*` → `./src/*` (and `./` for assets)
- `@/assets/*` → `./assets/*`

### Backend (`workspaces/backend/`)

Meteor.js app running on port 8100 with TypeScript. Key structure:
- `imports/api/accounts/accounts.methods.ts` — Meteor methods: `registerNewUser`, `updateUser`
- `imports/startup/server/accounts.config.ts` — Accounts system configuration
- Requires `settings.json` at startup (passed via `--settings settings.json`)

Shared types between app and backend come from `workspaces/types/`.
