# Web is an invite landing page, not an app

On the web, Prezentowo is one unauthenticated page, `GET /e/:code`, served by Meteor as a plain React bundle. It shows the event title, the inviter's name and app-store links. The same domain hosts `apple-app-site-association` and `assetlinks.json`, so an installed app opens `https://prezentowo.pl/e/<code>` directly and the landing page is only the fallback.

## Considered Options

- **Full parity via react-native-web.** Rejected. It forks the three most load-bearing subsystems anyway: the chat SDK, the `@meteorrn/core` DDP layer and the `expo-sqlite` cache. NativeWind's build integration is also Metro-only.
- **A separate full web client** (`stream-chat-react`, Meteor's Rspack). Feasible, but it is a second app to build and keep in sync, with no requirement driving it.

## Consequences

- There is no join-from-web, no web chat, no web offline and no web upload.
- Mobile navigation doesn't need to accommodate a browser layout.
- The landing page shares no components with mobile.
