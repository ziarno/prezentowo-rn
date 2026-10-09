# Web is an invite landing page, not an app

On the web, Prezentowo is one unauthenticated page, `GET /e/:code`, served by Meteor as a plain React bundle. It shows the event title, the inviter's name and app-store links. The same domain hosts `apple-app-site-association` and `assetlinks.json`, so an installed app opens `https://prezentowo.jarno.pl/e/<code>` directly and the landing page is only the fallback.

Amended ([#77](https://github.com/ziarno/prezentowo-rn/issues/77)): `/` and every unknown path also serve a static brand page, which is still unauthenticated and not an app. A fuller marketing page may replace it later.

Amended ([#84](https://github.com/ziarno/prezentowo-rn/issues/84), [#87](https://github.com/ziarno/prezentowo-rn/issues/87)): the site also serves `/privacy`, `/terms` and `/delete-account`. They are server-rendered, never hydrated, and have no JS. `/delete-account` is the web's first state-changing action, because Google Play requires deletion without the app. It is authenticated only by a single-use token emailed to the account's address, never by a session, and its GET pages never change state. It is still not an app: there is no sign-in on the web.

## Considered Options

- **Full parity via react-native-web.** Rejected. It forks the three most load-bearing subsystems anyway: the chat SDK, the `@meteorrn/core` DDP layer and the `expo-sqlite` cache. NativeWind's build integration is also Metro-only.
- **A separate full web client** (`stream-chat-react`, Meteor's Rspack). Feasible, but it is a second app to build and keep in sync, with no requirement driving it.

## Consequences

- There is no join-from-web, no web chat, no web offline and no web upload. The one write the web can make is deleting an account.
- Mobile navigation doesn't need to accommodate a browser layout.
- The landing page shares no components with mobile.
