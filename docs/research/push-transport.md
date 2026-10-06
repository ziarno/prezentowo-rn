# Push transport on a self-hosted Meteor

Research for [#80](https://github.com/ziarno/prezentowo-rn/issues/80), part of map [#78](https://github.com/ziarno/prezentowo-rn/issues/78). Researched 2026-10-06.

**Question.** How do we deliver push notifications from a Meteor server on a home box to an Expo SDK 57 development build on iOS and Android? Expo Push Service (`expo-server-sdk-node`) vs direct APNs plus FCM HTTP v1.

This note gathers facts. The recommendation near the end is a recommendation, not a decision. [ADR 0003](../adr/0003-no-push-notifications.md) currently rules push out; the map reopens it, so that ADR will need superseding whichever transport wins.

Sources are primary: docs.expo.dev (fetched as Markdown, "modificationDate" July 28 2026 on the setup page), Expo's own source on GitHub (`expo/expo`, `expo/expo-server-sdk-node`), developer.apple.com (documentation JSON and Xcode 14 release notes), firebase.google.com, the npm registry, and `meteor/meteor` at `release-3.5`. Claims I could not confirm are in [Unverified](#unverified-or-open).

## Repo facts this depends on

- Mobile is Expo `^57.0.0`, RN 0.86.3. Already installed: `expo-application`, `expo-constants`, `expo-device`, `expo-dev-client`. **Not installed:** `expo-notifications`. `workspaces/mobile/app.json` has no `extra.eas.projectId` and no `android.googleServicesFile`. iOS bundle id and Android package are both `com.prezentowo.app`.
- Backend is `METEOR@3.5.2`. Meteor `release-3.5` bundles Node 24.15.0 ([`scripts/build-dev-bundle-common.sh`](https://github.com/meteor/meteor/blob/release-3.5/scripts/build-dev-bundle-common.sh)). `expo-server-sdk` 7.2.0 (npm `latest`) declares `engines.node >=22.12.0` and depends on `undici`, `promise-limit`, `promise-retry`. The backend already depends on `undici ^7.24.4`.
- Meteor only needs outbound HTTPS for either transport. Nothing has to be reachable from the internet for push, so the home box's inbound situation is irrelevant.

## The two paths

```
Expo:    app --getExpoPushTokenAsync--> exp.host (registers device token + projectId)
         Meteor --POST exp.host/--/api/v2/push/send--> Expo --> APNs / FCM --> device

Direct:  app --getDevicePushTokenAsync--> APNs hex token / FCM token
         Meteor --HTTP/2 + ES256 JWT--> api(.sandbox).push.apple.com --> device
         Meteor --HTTPS + OAuth2 SA token--> fcm.googleapis.com/v1/... --> device
```

Both are first-class in Expo's docs: the `expo-notifications` API is "push-service agnostic" and Expo documents the direct route in ["Send notifications with FCM and APNs"](https://docs.expo.dev/push-notifications/sending-notifications-custom.md). Calling `getDevicePushTokenAsync()` gives the native token instead of `getExpoPushTokenAsync()` ([same page](https://docs.expo.dev/push-notifications/sending-notifications-custom.md)). The [Expo token source](https://raw.githubusercontent.com/expo/expo/main/packages/expo-notifications/src/getExpoPushTokenAsync.ts) fetches the device token first and then registers it, so an app could hold both.

## Credentials: what, where, and the EAS question

| | Expo Push Service | Direct APNs + FCM |
|---|---|---|
| Apple | Paid Apple Developer Program membership; an APNs `.p8` key **uploaded to Expo** (EAS credentials) | Same membership; the `.p8` key, its 10-char Key ID and your Team ID **live on our Meteor server** |
| Google | Firebase project; a service-account JSON (FCM v1) **uploaded to Expo**; `google-services.json` in the app | Same Firebase project and `google-services.json`; the service-account JSON **lives on our server** |
| Expo account | **Required** (see below) | Not required |
| `projectId` | **Required client-side** | Not used |

**Does Expo Push need an EAS project? Yes, in practice, but not EAS Build.**

- The client call fails without a `projectId`. Source: `getExpoPushTokenAsync` throws `ERR_NOTIFICATIONS_NO_EXPERIENCE_ID` ("No "projectId" found...") when it can't resolve `options.projectId`, `Constants.easConfig.projectId` or `expo.extra.eas.projectId` ([source](https://raw.githubusercontent.com/expo/expo/main/packages/expo-notifications/src/getExpoPushTokenAsync.ts)). The docs call it "the Universally Unique Identifier (UUID)" of the EAS project and say it is "used to attribute Expo push token to the specific project" ([setup](https://docs.expo.dev/push-notifications/push-notifications-setup.md)).
- Expo holds the push credentials per project. The FCM guide has you upload the service-account JSON via `eas credentials` or expo.dev; the setup guide says "If you are not using EAS Build, run `eas credentials` manually" ([FCM v1 credentials](https://docs.expo.dev/push-notifications/fcm-credentials.md), [setup](https://docs.expo.dev/push-notifications/push-notifications-setup.md)). Sending to a project with no credentials is an error ([sending](https://docs.expo.dev/push-notifications/sending-notifications.md)).
- Local builds are explicitly fine: "you can use the `expo-notifications` library without EAS Build by building your project locally" ([setup](https://docs.expo.dev/push-notifications/push-notifications-setup.md)). `eas init` ("Create or link an EAS project") produces the `projectId` and writes `extra.eas.projectId` ([EAS CLI](https://docs.expo.dev/eas/cli.md)). That keeps `expo run:ios|android` as the build path (see AGENTS.md) while adding an Expo account + linked project as a dependency.
- Docs recommend setting `projectId` in code rather than relying on auto-injection: "`projectId` is set automatically when you create a development build. However, we recommend setting it manually" ([setup](https://docs.expo.dev/push-notifications/push-notifications-setup.md)). With local builds there is no EAS Build to inject it, so commit it in `app.json`.
- Expo's APNs push key: max 2 per Apple account, not app-specific, never expires, revoking it breaks every app that uses it; uploading a replacement does not change users' Expo push tokens ([app credentials](https://docs.expo.dev/app-signing/app-credentials.md)).

**Apple Developer Program.** Apple's [supported-capabilities (iOS) table](https://developer.apple.com/help/account/reference/supported-capabilities-ios/) marks "Push notifications" for ADP and ADEP and leaves the free "Apple Developer" column empty. Expo says the same: "A paid Apple Developer Account is required to generate credentials" ([setup](https://docs.expo.dev/push-notifications/push-notifications-setup.md)). The owner needs to confirm they have a paid membership (needed for a store release anyway).

**Direct APNs key details** ([Apple: token-based connection](https://developer.apple.com/documentation/usernotifications/establishing-a-token-based-connection-to-apns)):

- JWT: header `alg: ES256`, `kid` = Key ID; claims `iss` = Team ID, `iat`. Reject if `iat` is more than an hour old.
- Refresh "no more than once every 20 minutes and no less than once every 60 minutes". A newer token more than once per 20 min on the same connection returns `TooManyProviderTokenUpdates` (429).
- New team-scoped keys are restricted to Sandbox *or* Production, max two per environment. Older keys that work in both keep working, but Apple recommends environment-specific ones. So direct APNs likely means one sandbox key and one production key (or one legacy dual key).
- A connection is bound to one team's topics on first push.

**Direct FCM credentials.** HTTP v1 endpoint `POST https://fcm.googleapis.com/v1/projects/{projectId}/messages:send`, `Authorization: Bearer <OAuth2 token>` with scope `https://www.googleapis.com/auth/firebase.messaging` minted from a service-account JSON ([Firebase](https://firebase.google.com/docs/cloud-messaging/send/v1-api)). Expo shows the same flow with `google-auth-library` ([custom guide](https://docs.expo.dev/push-notifications/sending-notifications-custom.md)). `firebase-admin` is the official server library ([Firebase admin SDK](https://firebase.google.com/docs/cloud-messaging/send/admin-sdk), linked from the Expo guide).

## `expo-notifications` setup for SDK 57 and dev-build caveats

Both transports need the same client setup. Everything below is from the [setup guide](https://docs.expo.dev/push-notifications/push-notifications-setup.md) and the [SDK reference](https://docs.expo.dev/versions/latest/sdk/notifications.md) unless noted. `expo-notifications` is on npm dist-tag `sdk-57` = 57.0.22.

1. `npx expo install expo-notifications` (`expo-constants` is already present).
2. Add `"expo-notifications"` to `plugins` in `workspaces/mobile/app.json`. Optional properties: `icon`, `color`, `defaultChannel` (Android), `sounds`, `enableBackgroundRemoteNotifications` (iOS, default false; only for silent/headless pushes).
3. iOS entitlement: the plugin always writes `aps-environment = development`; "Xcode automatically changes this to 'production' in the archive generated by a release build" ([SDK reference](https://docs.expo.dev/versions/latest/sdk/notifications.md)). No Info.plist usage string is needed.
4. Android: add `expo.android.googleServicesFile` pointing at `google-services.json` (safe to commit: "public-facing identifiers") ([FCM v1 credentials](https://docs.expo.dev/push-notifications/fcm-credentials.md)). If the key in that file is API-restricted, allow the FCM Registration API and Firebase Installations API, and use the Play *app signing* SHA-1, not the upload key's, or the app "never receives a push token" ([same page](https://docs.expo.dev/push-notifications/fcm-credentials.md)). **Needed for both transports**: the client registers with FCM either way.
5. Android 13+: the permission prompt does not appear until a notification channel exists, so call `setNotificationChannelAsync` before `getDevicePushTokenAsync`/`getExpoPushTokenAsync`.
6. iOS permission: read `ios.status`, not the top-level `status` (granular: `NOT_DETERMINED`, `DENIED`, `AUTHORIZED`, `PROVISIONAL`, `EPHEMERAL`).
7. Rebuild native: per AGENTS.md, after changing plugins run `npx expo prebuild -p ios|android` (or `--clean`) then `expo run:*`. Expo's local-build guide: `expo run:*` reuses existing native dirs, and re-prebuild "layers the changes on top" ([local app development](https://docs.expo.dev/guides/local-app-development.md)).

Dev-build caveats:

- Expo Go on Android has no remote push since SDK 53. Irrelevant here (dev client), but `expo-dev-client` is the right target.
- Android *debug* builds: launching from a notification can break the splash screen about 70% of the time; "does not occur in release builds" ([SDK reference, Known issues](https://docs.expo.dev/versions/latest/sdk/notifications.md)). Test notification-launch behaviour in a release variant.
- Dev builds on iOS use the **sandbox** APNs environment (entitlement `development`); App Store/TestFlight builds use production. Expo exposes the environment: `ExpoPushTokenOptions.development` defaults to `Application.getIosPushNotificationServiceEnvironmentAsync()` ([SDK reference](https://docs.expo.dev/versions/latest/sdk/notifications.md)). With direct APNs we must record that flag per token and pick `api.sandbox.push.apple.com` vs `api.push.apple.com` ([Apple: sending requests](https://developer.apple.com/documentation/usernotifications/sending-notification-requests-to-apns); Apple's `BadDeviceToken` text says the token must match the environment). Expo's service does this for us.
- A physical iPhone dev build needs the Push Notifications capability in its provisioning profile (paid team, see above).

## Token registration and lifecycle

| Event | Expo Push | Direct |
|---|---|---|
| Registration | `getExpoPushTokenAsync({projectId})` → `ExponentPushToken[...]`; client POSTs `deviceToken`, `deviceId`, `appId`, `projectId`, `development` to `exp.host/--/api/v2/push/getExpoPushToken` ([source](https://raw.githubusercontent.com/expo/expo/main/packages/expo-notifications/src/getExpoPushTokenAsync.ts)). The call hits the network, can reject offline, so docs say to `try/catch` and retry later. | `getDevicePushTokenAsync()` → APNs hex string (iOS) / FCM token (Android). We upload it to Meteor ourselves. |
| Token rotation | Automatic. After a successful Expo registration the library installs a global push-token listener and re-registers the new device token with Expo ([source](https://raw.githubusercontent.com/expo/expo/main/packages/expo-notifications/src/DevicePushTokenAutoRegistration.fx.ts)). The `ExpoPushToken` stays stable. | Ours. `addPushTokenListener` fires when the token changes: "the old one becomes invalid and sending notifications to it will fail" ([SDK reference](https://docs.expo.dev/versions/latest/sdk/notifications.md)). Apple: "Never cache device tokens in local storage"; ask on every launch and forward ([Apple: registering](https://developer.apple.com/documentation/usernotifications/registering-your-app-with-apns)). Firebase: store a timestamp on every upload; treat a registration as stale after about a month ([FCM token management](https://firebase.google.com/docs/cloud-messaging/manage-tokens)). |
| Reinstall | iOS: same `ExpoPushToken` after reinstall. Android: may change. Changing `applicationId` changes it. "Never expires" ([Expo FAQ](https://docs.expo.dev/push-notifications/faq.md)). | APNs issues a new token on restore-from-backup, new device, OS reinstall (Apple: registering). |
| Uninstall / permission revoked | Receipt `details.error = DeviceNotRegistered`, but only once Google/Apple deem the device unregistered, which takes an undefined time and is often impossible to test by uninstalling and sending right away ([sending](https://docs.expo.dev/push-notifications/sending-notifications.md)). | APNs `410 Unregistered` (with a `timestamp`), `400 BadDeviceToken`; FCM `404 UNREGISTERED` (also `400 INVALID_ARGUMENT` when the payload is known-valid). Delete the record ([Apple: responses](https://developer.apple.com/documentation/usernotifications/handling-notification-responses-from-apns), [FCM errors](https://firebase.google.com/docs/reference/fcm/rest/v1/ErrorCode), [FCM token management](https://firebase.google.com/docs/cloud-messaging/manage-tokens)). Android registrations expire after 270 days inactive. |
| Multiple devices per user | Supported by design: one token per install. Server keeps N tokens per user. | Apple: "a user can have multiple devices, prepare your app to handle multiple device tokens" (Apple: registering). Same on FCM. |
| Sign-out | **No platform mechanism.** The server must unbind the token. `unregisterForNotificationsAsync()` exists but is undocumented ("@docsMissing"); on iOS its native code only calls `UIApplication.unregisterForRemoteNotifications()`, it does not tell any server ([source](https://raw.githubusercontent.com/expo/expo/main/packages/expo-notifications/ios/ExpoNotifications/PushToken/PushTokenModule.swift)). | Same. |

Design consequences for this app (not decisions):

- Store `{userId, platform, token, kind: 'expo'|'apns'|'fcm', apnsEnv?, deviceId, updatedAt}`. Make `token` unique so signing in as user B on a device moves the binding instead of leaving A's.
- Registration and unregistration are online-only writes. They fit the existing rule that anything outside `src/api/queuedWrites.ts` stays `call` (AGENTS.md). A sign-out while offline cannot unbind, so the previous user would keep receiving pushes on that device until the next sign-in rebinds the token. That needs a server-side answer (for example, unbinding when the login token is removed, or a receipt/410 path), and is a question for the grilling.
- Treat receipts/410s as the only cleanup for uninstalls. There is no uninstall signal.

## Sending, receipts, errors

**Expo Push** ([sending guide](https://docs.expo.dev/push-notifications/sending-notifications.md), [FAQ](https://docs.expo.dev/push-notifications/faq.md), [`expo-server-sdk-node` README](https://github.com/expo/expo-server-sdk-node)):

- `POST https://exp.host/--/api/v2/push/send`; body is one message or an array of up to 100, all for the same project. Fields include `to`, `title`, `body`, `data`, `sound`, `badge`, `ttl`, `priority`, `collapseId`, `threadId`, `channelId`.
- Response is a **ticket** per message: `ok` + receipt `id` means "received by Expo's servers, **not** that it was received by the user". Ticket-level errors are possible (e.g. `DeviceNotRegistered`).
- **Receipts**: `POST .../push/getReceipts` with `{ids: [...]}`, max 1000 ids; "We recommend checking push receipts 15 minutes after sending"; cleared after 24 hours. "You must check your push receipts." Receipt `ok` still does not guarantee device delivery.
- Errors: `DeviceNotRegistered` (stop sending to that token), `MessageTooBig` (payload > 4096 bytes), `MessageRateExceeded` (per-device; back off), `InvalidCredentials` (APNs key / FCM SA revoked or wrong). Request-level: `TOO_MANY_REQUESTS`, `PUSH_TOO_MANY_RECEIPTS`, HTTP 429/5xx → exponential backoff.
- `expo-server-sdk-node` 7.2.0: `Expo.isExpoPushToken`, `chunkPushNotifications`, `sendPushNotificationsAsync`, `chunkPushNotificationReceiptIds`, `getPushNotificationReceiptsAsync`; gzips, caps concurrency at six connections, throttles, retries with backoff. Constructor takes `accessToken` for the optional push-security mode.
- Optional "enhanced push security": require an Expo access token on every send, else `UNAUTHORIZED`. Default is no authentication, so a leaked `ExpoPushToken` lets anyone push to that device ("We have never had an instance of this report", Expo says).
- Delivery: Expo states it has no SLA and is designed for at-least-once hand-off to Google/Apple, so rarely a message can arrive twice or not at all ([FAQ](https://docs.expo.dev/push-notifications/faq.md)). So the handler must be idempotent (put the `NotificationDoc._id` in `data`).
- Needs a receipt-polling job (about 15 min after send) in Meteor: persist ticket ids, poll, delete tokens on `DeviceNotRegistered`.

**Direct APNs** ([Apple: sending requests](https://developer.apple.com/documentation/usernotifications/sending-notification-requests-to-apns), [responses](https://developer.apple.com/documentation/usernotifications/handling-notification-responses-from-apns)):

- HTTP/2 + TLS 1.2+, `POST /3/device/<token>`, hosts `api.push.apple.com` (production) and `api.sandbox.push.apple.com` (development), port 443 or 2197. Headers: `authorization: bearer <jwt>`, `apns-topic` (bundle id), `apns-push-type: alert`, optional `apns-priority`, `apns-expiration`, `apns-collapse-id` (≤ 64 bytes). Payload ≤ 4096 bytes, uncompressed.
- Result is **synchronous per request**; no receipt polling. Success 200 with empty body. Errors: `410 Unregistered`/`ExpiredToken` (delete, don't retry), `400 BadDeviceToken`/`DeviceTokenNotForTopic` (don't retry), `413 PayloadTooLarge`, `429 TooManyRequests` (same token; retry with delay), `429 TooManyProviderTokenUpdates`, `403 ExpiredProviderToken`/`InvalidProviderToken`, `5xx` (retry after 15 min). Error responses slow you down and APNs may drop connections that produce many.
- If APNs can't deliver immediately it stores one notification per bundle ID per device for up to 30 days (depending on `apns-expiration`); delivery may be reordered and throttled.
- Node's built-in `http2` is enough (Expo's own example does this); there is no first-party Apple library. Needs session reuse, JWT caching with the 20–60 min refresh window, reconnect on `GOAWAY`.

**Direct FCM** ([FCM error codes](https://firebase.google.com/docs/reference/fcm/rest/v1/ErrorCode), [message lifetime](https://firebase.google.com/docs/cloud-messaging/customize-messages/setting-message-lifespan), [message types](https://firebase.google.com/docs/cloud-messaging/customize-messages/set-message-type)):

- `404 UNREGISTERED` → delete the token. `400 INVALID_ARGUMENT` (bad token or bad payload). `403 SENDER_ID_MISMATCH`. `429 QUOTA_EXCEEDED` ("exponential backoff with a minimum initial delay of 1 minute"). Payload ≤ 4096 bytes. `ttl` 0 to 2,419,200 s (4 weeks, the default).
- Also synchronous: the send response is the result.

## Rate limits, cost, privacy

| | Expo Push | APNs | FCM |
|---|---|---|---|
| Throughput | 600 notifications/s per project; 100 per request ([sending](https://docs.expo.dev/push-notifications/sending-notifications.md), [FAQ](https://docs.expo.dev/push-notifications/faq.md)) | No published global rate; per-token `TooManyRequests`; connection dropped on many errors | Default 600K quota tokens per 1-minute bucket ([scale FCM](https://firebase.google.com/docs/cloud-messaging/scale-fcm)); per-device limit exists |
| Payload | 4096 bytes total | 4096 bytes | 4096 bytes |
| Cost | "There is no cost associated with sending notifications through Expo push notification service" ([FAQ](https://docs.expo.dev/push-notifications/faq.md)) | Free service, but needs the paid Apple Developer Program | "No-cost" on Spark and Blaze ([Firebase pricing](https://firebase.google.com/pricing)) |

Any of these limits is orders of magnitude above a family/friends gift app's volume. The binding constraints are operational (credentials, receipts, token hygiene), not throughput.

**Privacy.**

- Expo path: the notification content passes through Expo's servers on its way to Apple/Google. Expo's FAQ says its connections to Apple/Google use HTTPS, that contents are held only in memory and message queues (not databases) until delivered, and that staff may see contents while actively debugging the service. Expo also receives, at token registration, the device token, an installation id (`deviceId`), the app id and the project id ([source](https://raw.githubusercontent.com/expo/expo/main/packages/expo-notifications/src/getExpoPushTokenAsync.ts)). Expo additionally holds our APNs key and FCM service-account key.
- Direct path: only Apple and Google (always in the path) see payloads. The signing keys stay on our box.
- Either way Apple/Google see the alert text. Gift-claim notifications in this app carry `giftTitle` snapshots (spec §1.7); the grilling should decide how much goes into the visible alert versus a minimal `data` payload (`{notificationId, kind, eventId}`) that the app resolves over DDP. Keeping alert text generic is the only way to keep it out of third-party hands on the Expo path.

## iOS simulator and Android emulator testing

- Expo: you can test "on a physical Android or iOS device, on an Android Emulator with Google Play services, or on an iOS Simulator running on Xcode 14 or later (macOS 13+, iOS 16+)" ([setup](https://docs.expo.dev/push-notifications/push-notifications-setup.md)).
- Apple, Xcode 14 release notes: "Simulator now supports remote notifications in iOS 16 when running in macOS 13 on Mac computers with Apple silicon or T2 processors", against the **APNs Sandbox** (`api.sandbox.push.apple.com`); each simulator gets registration tokens unique to simulator + Mac; tokens "may be larger than current physical device tokens. Don't hardcode any specific length or format" ([Xcode 14 release notes](https://developer.apple.com/documentation/xcode-release-notes/xcode-14-release-notes)). So direct-APNs token columns must not assume a length.
- Local-only test without any server: `xcrun simctl push` and `.apns` payload files (same release notes). That exercises display and tap handling but not registration or the server path.
- `expo-notifications` source warns that obtaining a push token "may not reliably work on the iOS 26.0 simulator due to an iOS issue" and to use a real device ([source](https://raw.githubusercontent.com/expo/expo/main/packages/expo-notifications/ios/ExpoNotifications/PushToken/PushTokenModule.swift); linked Apple forum thread 795433). 26.0 only; later runtimes are not flagged.
- Android: emulator image must include Google Play services.
- On the Expo path a simulator token still routes through Expo to the sandbox, so Expo needs the APNs key uploaded even for simulator testing. On the direct path, simulator tokens go to the sandbox host with a sandbox-capable key.

## Comparison

| Concern | Expo Push Service | Direct APNs + FCM |
|---|---|---|
| Server code | `expo-server-sdk` + a receipt-polling job; one code path for both OSes | JWT signer + cached HTTP/2 APNs client, FCM OAuth2 client (or `firebase-admin`), per-token environment routing, retry/backoff for both |
| Client token | `getExpoPushTokenAsync({projectId})`, auto re-registration on rotation | `getDevicePushTokenAsync()` + our own `addPushTokenListener` re-upload |
| Accounts | Apple paid + Firebase + **Expo account/EAS project** | Apple paid + Firebase |
| Secrets held by | Expo (APNs key, FCM SA JSON); us only optionally an access token | Us (`.p8`, SA JSON) |
| Errors | Two-step (ticket, receipt ~15 min later) | Immediate per request |
| Third party in payload path | Expo, plus Apple/Google | Apple/Google only |
| Service risk | Extra hop; "no SLA" | None beyond Apple/Google |
| Lock-in | Low: `getDevicePushTokenAsync` is the way out | None |

## Recommendation (not a decision)

For this project, I'd lean to **Expo Push Service with `expo-server-sdk-node`**:

- It is one code path for both OSes. The server is a send call plus a periodic receipt sweep, instead of hand-rolling an APNs HTTP/2 client with JWT rotation and sandbox/production routing, and a separate FCM auth client.
- Token rotation is handled in the library, which removes the most error-prone client-side piece.
- The cost is an extra dependency: create an Expo account and run `eas init` to get a `projectId`, upload the two credentials once with `eas credentials`, and accept that Expo is in the payload path. That cost is real but small, and local `expo run:*` builds are unaffected.
- The direct route is a reasonable choice if the owner doesn't want an Expo account or a third party seeing notification text. It is more code (APNs signer + client, FCM client, token cleanup; my estimate is a few hundred lines). Keeping a `kind` column on stored tokens keeps a later switch cheap, and the client can capture both tokens.

What would flip this: a hard requirement that notification content never touches Expo, or unwillingness to create an Expo account.

Either way, the same decisions remain for the grilling: payload minimalism, offline sign-out unbinding, which kinds push, and per-kind preferences (storage and checking server-side before send).

## Unverified or open

- **Whether an arbitrary UUID works as `projectId`.** Docs and source treat it as an EAS project id and credentials are per EAS project; I did not test the live endpoint with a made-up one. Plan on a real `eas init`.
- **Whether "enhanced push security" (access tokens) is available on a free Expo plan.** Not stated in the pages read.
- **How EAS stores APNs keys relative to Apple's sandbox/production-scoped keys.** Apple's new keys are environment-scoped; Expo's docs describe one "Push Notification Key" per account and say nothing about the split. Check when generating the key.
- **Apple Developer Program membership** for the owner: not checked.
- **`unregisterForNotificationsAsync` on Android**: I read iOS only; the docs entry is empty.
- **FCM's move from registration tokens to Firebase Installation IDs.** The FCM token page says both are co-supported and that its guidance applies to both. `expo-notifications` still returns FCM tokens. Worth watching, not a blocker.
- **Apple's APNs global rate limits**: none published in the pages read.
- **Expo's Privacy Policy** (data retained about tokens/devices) was not read; the FAQ statements above are only about message contents.
