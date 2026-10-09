# Stream Chat push alongside Expo Push, in an Expo dev build

Research notes for [issue #85](https://github.com/ziarno/prezentowo-rn/issues/85), part of the
[Profile map #78](https://github.com/ziarno/prezentowo-rn/issues/78).

- **Date:** 2026-10-09
- **Method:** primary sources only. Stream's own docs (fetched as Markdown by appending `.md` to a docs URL, a route
  the docs advertise themselves) and its published OpenAPI spec
  ([`GetStream/protocol`](https://github.com/GetStream/protocol), `openapi/chat-openapi.json`). The `stream-chat@9.54.0`
  and `stream-chat-expo@9.9.2` npm tarballs (source and types). The Expo docs for SDK 57 and the
  `expo-notifications@57.0.22` tarball (Kotlin and Swift source). One Apple developer page. No blog posts, no
  third-party write-ups.
- **Not done:** no Stream account or app was touched, no device was registered, no push was sent. Everything below is
  read from docs and source, not observed. Section 11 lists what a live spike must confirm.
- **Local context read:** `docs/spec.md` §2.4 and §7, `workspaces/backend/docs/adr/0001-chat-thread-lifecycle.md`, and
  `workspaces/backend/imports/api/chat/chat.server.ts` / `chat.sync.ts` for what the server already calls on Stream.

Versions in play: `stream-chat` `^9.53.0` (backend and mobile; latest is 9.54.0), `stream-chat-expo` `^9.9.2`,
Expo SDK 57. `expo-notifications` is **not installed yet** (`workspaces/mobile/package.json` has `expo-device` only).

---

## 0. Short answers

| Question | Answer |
| --- | --- |
| Register/remove a device server-side, no `connectUser`? | **Yes, per the API definition.** `POST /devices` takes `user_id` ("Server-side only. User ID which server acts upon"). In `stream-chat` it is `addDevice(id, push_provider, userID, push_provider_name)`, `removeDevice(id, userID)`, `getDevices(userID)`. Not exercised live (§11). |
| Which token? | The **native** token, not an Expo token: `getDevicePushTokenAsync()` gives an APNs hex string on iOS (provider `apn`) and an FCM token on Android (provider `firebase`). |
| Can a device hold both registrations? | **Yes in practice.** The Stream registration and the Expo Push registration are independent records at two senders for the same native token. Apple says one signing token may be used from multiple provider servers. Neither Stream nor Expo states it explicitly (inference, §2). |
| Provider setup | iOS: **APNs `.p8` directly, no Firebase.** Android: **Firebase service-account JSON** (same Firebase project Expo uses). Multiple named providers are supported (up to 25), and we will want one APNs provider per APNs environment (§3). |
| Plan/billing | Push is listed as included on **all four plans** (Build, Start, Elevate, Enterprise), and the Maker account is a Start plan. No per-push metering is published. Limits: 25 devices per user, 25 providers per app. Whether server-side registration counts toward MAU is not documented (§4). |
| Payloads | iOS (APNs provider): a visible `aps.alert` plus a custom `stream` object holding `cid`. Android (Firebase provider): **data-only by default, nothing is shown** until the template adds an `android.notification`. `expo-notifications` reads the tap data from a different place on each platform (§5). |
| Localization | **Yes, per user, not per device.** Templates are Handlebars with a `receiver` object that exposes the user's custom fields and an `equal` helper, so a `language` field on the Stream user can pick the string (§6). |
| One "Chat messages" toggle | **Yes.** `setPushPreferences([{ user_id, chat_level: 'none' | 'all' }])` server-side. `none` suppresses every chat push for the user (§7). |
| Secret threads | Only channel members are pushed, so the beneficiary never gets one. Retired threads keep their members, so they are safe only because they are **frozen**, and the freeze has to land before any message can (§8). |
| Foreground suppression | **Client side.** Stream pushes regardless of online status. `Notifications.setNotificationHandler` decides (§9). |

Three things that are not in the question but will bite:

1. **Stream's default templates set the iOS badge to Stream's `unread_count`.** The spec says the bell never shows
   Stream's unread count. Override the template (§5.3).
2. **Push is off until `message.new` is enabled per provider** through the push-templates endpoint, and
   `stream-chat@9.54.0` has no helper for it (§5.3).
3. **`expo-notifications` on iOS exposes only the `body` key of a remote payload as `content.data`.** Stream's `stream`
   key is only reachable through `trigger.payload` (§5.4).

---

## 1. Can the server register and remove devices?

### The API

From the REST definition ([`chat-openapi.json`](https://raw.githubusercontent.com/GetStream/protocol/main/openapi/chat-openapi.json)):

- `POST /devices`, operation `CreateDevice`. "Adds a new device to a user, if the same device already exists the call
  will have no effect". Body: `id` (the token, 1 to 255 chars), `push_provider` (`firebase | apn | huawei | xiaomi`),
  `push_provider_name`, `user_id` ("**Server-side only**. User ID which server acts upon"), an optional `user`
  (`UserRequest`, so the user can be upserted in the same call), `voip_token`, `hardware_id`.
- `DELETE /devices?id=…&user_id=…`, operation `DeleteDevice`. `user_id` is again server-side only.
- `GET /devices?user_id=…`, operation `ListDevices`.

In the `stream-chat@9.54.0` Node client (`src/client.ts`, which the backend already uses, `chat.server.ts`):

```ts
await client.addDevice(token, 'apn' | 'firebase', userId, providerName?) // POST /devices
await client.removeDevice(token, userId)                                  // DELETE /devices
await client.getDevices(userId)                                           // GET /devices
```

The JSDoc says `removeDevice`: "Clientside users can only delete their own devices … Only specify [`userID`] for
serverside requests", and `getDevices`: "`userID` … Only works on serverside". The platform docs'
[Registering devices](https://getstream.io/docs/platform/push-devices/) show a Node tab with `client.createDevice({ id,
push_provider, push_provider_name, user_id })` for the newer unified SDK. It hits the same endpoint.

The docs also say "Register the user's device … once your user is successfully connected" and the React Native guide
warns "`client.addDevice` requires a user token, so call it after `client.connectUser`". Both describe the
**client-side** call. Nothing in the server-side definition requires a connection. This is the load-bearing point and
it should be proved with a spike (§11).

### Consequences for our design

- The app never needs `connectUser` for push. It only needs to hand its native token to our server, which calls
  `addDevice`. This fits the existing pattern, where the server already upserts users before touching channels
  (`upsertNamedUsers` in `chat.sync.ts`).
- The user must exist in Stream. The server already upserts every channel member. A user who has not yet joined any
  thread has no chat push to receive anyway.
- Removal needs the **token**, so the server has to remember it (a `devices` record per user in Mongo, which it needs
  for Expo Push anyway), or call `getDevices(userId)` and delete all of them on sign-out.
- Stream keeps at most **25 unique devices per user**. At the limit the oldest is replaced, and "if you reach limit of
  25 devices, API automatically remove one invalid or oldest device" on `add` without a prior delete
  ([push-devices](https://getstream.io/docs/platform/push-devices/),
  [push-troubleshooting](https://getstream.io/docs/platform/push-troubleshooting/)). A push goes to all registered
  devices of a member ([push-notifications → Push Delivery Rules](https://getstream.io/docs/platform/push-notifications/)).
- Stream marks a device `disabled` with a `disabled_reason` when the provider reports it invalid (device object, push-devices page).
  Tokens still need server-side cleanup on sign-out, because a disabled flag is not an unbind.
- **Shared phones:** the same native token is reused when user B signs in on user A's device. Our server must
  `removeDevice(token, A)` before `addDevice(token, B)`. Whether Stream permits one token under two users at once is
  not documented (§11). The push `data` carries `receiver_id`, so the client can also drop a push meant for someone else.

---

## 2. Which token, and can one device hold both registrations?

### Token type

[`expo-notifications`](https://docs.expo.dev/versions/v57.0.0/sdk/notifications/) `getDevicePushTokenAsync()`:
"Returns a native FCM, APNs token". The result is `{ type: 'ios' | 'android', data: string }`.

- iOS: `data` is the APNs device token as a hex string. Source: `NotificationsAppDelegateSubscriber.swift`
  (`data.map { String(format: "%02hhx", $0) }.joined()`). That is the format Stream's examples show (a 64-char hex id
  with `push_provider: "apn"`).
- Android: `data` is the FCM registration token. Needs `android.googleServicesFile` in `app.json` (Expo's
  [FCM credentials](https://docs.expo.dev/push-notifications/fcm-credentials/) page) and, on Android 13+, a notification
  channel created with `setNotificationChannelAsync` **before** the token is requested (SDK page, Permissions →
  Android).
- `getExpoPushTokenAsync()` returns an `ExponentPushToken[…]`. That is Expo's own routing handle and **Stream cannot
  use it**. Stream `push_provider` accepts only `apn | firebase | huawei | xiaomi`.

So the client sends **two** values to our server: the Expo token (for inbox) and the native token plus its platform (for
chat). Keep `addPushTokenListener` on the native token: "In rare situations, a push token may be changed by the push
notification service while the app is running. When a token is rolled, the old one becomes invalid" (SDK page). On a
change the server does remove-old, add-new for both systems.

### Both registrations on one device

Expo Push Service and Stream are two senders. Each holds its own credentials and each addresses the same APNs/FCM
token.

- **APNs.** Apple, [Establishing a token-based connection to APNs](https://developer.apple.com/documentation/usernotifications/establishing-a-token-based-connection-to-apns):
  "You can use the same token from multiple provider servers. You can use one token to distribute notifications for all
  or a subset of your company's apps." Both Expo (via the key held in EAS) and Stream (via the `.p8` we upload) sign
  requests for the same bundle-id topic.
- **FCM.** Both need a service account of the **same Firebase project** the app's `google-services.json` points to.
  Expo documents the service-account upload for its side; Stream's RN guide documents the same JSON for Stream's side.
- Stream's `hardware_id` ("deduplicate pushes across push providers (e.g. APNs VoIP and Firebase on the same iOS
  device)") is about Stream's own providers, not about Expo.

Neither vendor documents the combination, so this is an inference from the two models, not a quoted guarantee. The
risk is cosmetic: a device gets two independent notifications from two senders, which is what we want (chat from
Stream, inbox from Expo).

---

## 3. Provider setup

### iOS: APNs directly, no Firebase

[Push providers](https://getstream.io/docs/platform/push-providers/): "**APN** requires an Apple Developer account and
an authentication key or certificate", with fields Name, Bundle ID, Team ID, Key ID, Authentication Key (`.p8`). The
OpenAPI `PushProviderRequest` has `apn_auth_type` (`token` | `certificate`), `apn_auth_key`, `apn_key_id`,
`apn_team_id`, `apn_topic`, `apn_development`, `apn_p12_cert`, `apn_host`.

The React Native guide ([push-notifications](https://getstream.io/chat/docs/sdk/react-native/guides/push-notifications/))
walks through Firebase for **both** platforms (the APNs key is uploaded to Firebase and iOS gets an FCM token). That is
one supported path, not the only one: it needs `@react-native-firebase`, and we are not adding it. The native-APNs
route matches `getDevicePushTokenAsync()` on iOS and registers as `push_provider: 'apn'`. The Stream iOS guide
describes the same dashboard fields for a multi-bundle APNs config.

### Android: Firebase

"Firebase requires a service account key from your FCM project: Firebase console → project settings → service accounts
→ generate a new private key", uploaded as `firebase_credentials`. Android devices register as
`push_provider: 'firebase'`.

### Sandbox vs production APNs (dev client vs release)

- `expo-notifications` sets the iOS `aps-environment` entitlement to `development` and Xcode flips it to `production`
  in a release archive (SDK page, App config note; `plugin/src/withNotificationsIOS.ts` defaults `mode` to
  `'development'`). A dev client therefore produces **sandbox** APNs tokens, a release build **production** ones.
- Apple: team-scoped keys "restrict usage to either Sandbox or Production … Each environment can have a maximum of
  two keys", and older keys that work in both are still supported.
- Stream's provider has an `apn_development: boolean`. The prose docs never describe it, so its meaning is inferred from
  the name (§11).

So expect **two APNs providers** (for example `apn-dev` and `apn-prod`, with the right `apn_development`), each
referenced by `push_provider_name` at registration. The server picks the provider name from the build the token came
from, which the client can send (`__DEV__` is not enough for a local release build, so send the entitlement mode or a
build flag).

### Multiple providers, names, limits

- "Multiple providers can be added to the same Stream application" for prod/staging builds, platforms, tenants. "Up to
  25 push providers can be added to a single application." (push-providers.)
- `upsertPushProvider` / `listPushProviders` / `deletePushProvider` exist in `stream-chat@9.54.0` and work only when "v2
  push version is enabled on app settings" (JSDoc). The legacy-push page says push v1 is unsupported and "it is mandatory
  to upgrade to version 3". Check the app's `push_notifications.version` in `getAppSettings()` (§11).
- Provider `name` is 1 to 36 characters. The single-provider `updateAppSettings({ firebase_config })` route exists
  too, with an empty name. If `push_provider_name` is given and invalid, the registration fails with a bad request. If
  it is omitted, "devices will be matched with configurations according to only their types" (push-providers).
- Credentials are secrets that live in Stream (and in our provisioning), never in the repo.
- Changing credentials later: "linked devices might be invalidated in the next push message sent retry".

### Prerequisites outside Stream

A paid Apple Developer Program membership (APNs key, push entitlement) and a Firebase project with
`google-services.json`. Both are already needed for Expo Push (see #80), so Stream adds no new account.

---

## 4. Plan and billing

[Chat pricing](https://getstream.io/chat/pricing/) (Markdown at `/chat/pricing.md`):

- Feature list, "Included on all four plans (Build, Start, Elevate, Enterprise)": "**Push Notifications** -
  Customizable alerts for events like new messages or status updates". Developer Dashboard "(usage, billing, push
  notifications and moderation tools)" is also on all four.
- The Maker account (the plan the earlier research, [`getstream-chat.md`](getstream-chat.md), flagged as the one that
  matters) is "a modified Chat Start Plan with all the same capabilities, but with a limit of 2,000 monthly active
  users and 100 concurrent connections". So push is included there too.
- The page lists no per-push, per-device or per-notification charge, and no push rate limit. Billed dimensions are MAU,
  concurrent connections, stored messages, channels, API calls, API bandwidth. A push is a delivery to a third party,
  not an API call to Stream, but the page does not say how server-side `createDevice`/`setPushPreferences` calls are
  counted against "Total API Calls" (Build: 1M per month).
- **MAU.** "Monthly Active Users (MAUs) are defined as any user that connected to chat within the last calendar
  month." Server-side registration is not a connection, so by that definition it should not mark a user active. The
  page does not say it explicitly, and the linked billing-metrics article
  ([support.getstream.io](https://support.getstream.io/hc/en-us/articles/4403229982615)) is behind a Cloudflare check and could not be read.
  This is the property the spec depends on, so it is worth a one-line question to Stream support (§11).
- Documented hard limits: 25 devices per user, 25 providers per app, **4 KB** for data-only payloads.

---

## 5. Payload shape, and what `expo-notifications` has to do

### 5.1 Defaults ([Customizing Notifications](https://getstream.io/chat/docs/node/push-template/))

**APNs provider** (default template): a visible alert plus a custom `stream` object.

```json
{
  "payload": {
    "aps": {
      "alert": { "title": "You have a new message", "body": "{{ truncate message.text 150 }}" },
      "badge": {{ unread_count }}, "sound": "default", "mutable-content": 1, "content-available": 0
    },
    "stream": { "version": "v2", "sender": "stream.chat", "type": "{{ event_type }}",
                "id": "{{ message.id }}", "cid": "{{ channel.cid }}", "receiver_id": "{{ receiver.id }}" }
  }
}
```

**Firebase provider** (default template): **data only on Android**, plus an `apns.payload.aps.alert` for iOS-via-FCM.

```json
{ "data": { "version": "v2", "sender": "stream.chat", "type": "{{ event_type }}", "id": "{{ message.id }}",
            "message_id": "{{ message.id }}", "channel_type": "{{ channel.type }}", "channel_id": "{{ channel.id }}",
            "cid": "{{ channel.cid }}", "receiver_id": "{{ receiver.id }}" },
  "android": { "priority": "high" } }
```

"By default, there is only a data message and no notification field in the android payload." The `version` stays `v2`
"to ensure backward compatibility". The same page says data-only pushes "must not exceed 4KB".

### 5.2 What shows up on screen

- **iOS:** the OS draws `aps.alert` itself when the app is backgrounded or killed. No JS is needed. In the foreground
  the OS shows nothing unless `expo-notifications`' handler says so (§9).
- **Android, default template:** **nothing is shown.** A data message goes to the app, and a killed app is not woken
  unless a JS task is registered. Two ways out:
  1. **Add `android.notification` to the template** (Stream's own example: `title`, `body`, `sound`). It becomes an FCM
     notification message, which the OS draws when the app is backgrounded or killed, with no JS involved. In the
     foreground it reaches `expo-notifications` first. This is the option that matches iOS, and it is the one to take.
     Stream's example also sets `click_action: "OPEN_ACTIVITY_1"`, which needs a matching intent filter in the
     manifest. We should omit it and let the default launcher intent handle the tap (§11).
  2. Keep it data-only and show a local notification from `Notifications.registerTaskAsync` (Expo's "headless
     background notification"). Expo warns that delivery to the app is not guaranteed (Doze, throttling), and the task
     must be defined in a module loaded early. More code, weaker delivery. Stream's own RN guide takes this
     route with Notifee, and says of the notification-field route "We don't recommend this", because it can show
     notifications in the foreground on Android while iOS won't. Our foreground handler (§9) covers that.
- `expo-notifications` also auto-presents a data-only message on Android when `data.title` / `data.message` are set
  (`NotificationData.kt`, and the [notification types page](https://docs.expo.dev/push-notifications/what-you-need-to-know/)).
  Stream's data-only template section says `title` and `body` are "blacklisted fields to set to our `data` object"
  (they go in a `stream` object instead), so do not count on this.
- Neither `stream-chat-expo@9.9.2` nor its peer dependencies touch push (the tarball has no reference to
  `expo-notifications`, `addDevice` or `push_provider`). Stream gives no Expo-specific push guide, only the
  `@react-native-firebase` + Notifee one. Everything here is the generic provider route.

### 5.3 Template changes we need (and where to make them)

1. **Enable `message.new`.** The platform page says "Supports enabling/disabling push notifications for each
   notification type … By default, all notification types are disabled", and the template page says "make sure to
   enable push notifications for each notification type you plan to support". It is one call per provider, via
   `POST /push_templates` (`UpsertPushTemplate`):
   `{ "enable_push": true, "event_type": "message.new", "push_provider_type": "apn", "push_provider_name": "apn-prod", "template": "…" }`.
   Event types in the enum: `message.new`, `message.updated`, `reaction.new`, `notification.reminder_due`, and some
   `feeds.*`. We only want `message.new`; leaving `message.updated` and `reaction.new` off is what keeps edits and
   reactions from pushing.
2. **No SDK helper.** `grep` of `stream-chat@9.54.0` finds no `push_templates` or `upsertPushTemplate`. Use the
   dashboard, `getstream api UpsertPushTemplate`, or the raw client (`client.post(`${client.baseURL}/push_templates`, body)`,
   since `post` and `baseURL` are public). `GET /push_templates?push_provider_type=…` reads them back.
3. **Drop the badge.** The default APNs and FCM-iOS templates set `"badge": {{ unread_count }}`, which is **Stream's**
   unread count for that user. That contradicts spec §5 ("The bell shows only our notifications, never Stream's unread
   count") and would fight whatever badge the Expo inbox pushes set. Remove `badge` from the template and own the badge
   on our side.
4. **Titles.** The default APNs title is the fixed "You have a new message". A sender name is available
   (`{{ sender.name }}`, the server upserts it), so "New message from {{ sender.name }}" is possible. See §6 for language,
   and §8 for whether secret-thread text should reach a lock screen at all.
5. `push_notifications` is a boolean on the channel type, default `true` (channel-type fields table). Our two custom
   types inherit `messaging`, so nothing to do, but confirm with `getChannelType` (§11).

### 5.4 Handling a tap and deep-linking into a thread

`expo-notifications` (SDK 57) delivers a tap through `addNotificationResponseReceivedListener`, and
`useLastNotificationResponse()` / `getLastNotificationResponse()` for a cold start. Expo says to register the listener
"as early as possible (at module top-level) on iOS" and to also check the last response at startup.

**Where the Stream data lives differs per platform** (this is the part not visible from the docs):

- **iOS.** `NotificationRecords.swift`: for a remote push, `content.data` is `request.content.userInfo["body"]`, i.e.
  only a top-level `body` key (Expo Push Service's own convention). Stream's custom key is `stream`, so `content.data`
  will be empty for a Stream push. The full payload is on `notification.request.trigger.payload` ("full contents of
  `userInfo`"), so read `trigger.payload.stream.cid`. The alternative is to add `"body": { "cid": "{{ channel.cid }}" }`
  to the APNs template, which makes `content.data.cid` work and keeps one code path with Expo's inbox pushes. Both
  rely on Stream rendering extra top-level keys, which is plausible from the template docs and unverified (§11).
- **Android.** `trigger.remoteMessage.data` holds the FCM `data` (`cid`, `channel_id`, `receiver_id`, …). A tap on a
  notification message drawn by the OS is picked up from the launch intent
  (`ExpoNotificationLifecycleListener.onCreate`/`onNewIntent`, which requires `google.message_id` in the extras) and
  surfaces through the same listener, whether the app was killed or backgrounded.
- Distinguish the two senders in the handler by payload: Stream sets `sender: "stream.chat"` (`stream.sender` on iOS,
  `data.sender` on Android).

Mapping `cid` to our route: `cid` is `secret_thread:<random>` or `event_thread:<random>`, and the random id is
deliberately not derivable (ADR 0001). The app can only resolve it from `ChatThreads`. `chatThreads.byEvent(eventId)`
needs the event id, which the push does not carry. Options: a small method that resolves a `cid` to `{ eventId, kind,
recipientParticipantId }` for members, or putting `eventId` as a custom field on the channel and adding
`{{ channel.eventId }}` to the data template (custom channel fields are available in templates, §6). That is a spec
decision for the notifications slice.

---

## 6. Templates and localization

Templates are rendered with Handlebars. The context ([push-template](https://getstream.io/chat/docs/node/push-template/),
"Context Variables") includes `sender`, **`receiver`** ("You can access the user name, id or any other custom field you
have defined for the user"), `message`, `channel` (custom fields too), `isThread`, `isMentioned`, `unread_count`, `members`,
`otherMembers`. Helpers include `if`, `unless`, `equal`, `unequal`, `truncate`, `json`, `each`.

So per-**user** language works with nothing but data we control:

1. The server upserts the Stream user with a custom `language: 'pl' | 'en'` (it already upserts `{ id, name }`), and
   re-upserts when the user changes language.
2. The template picks the string:

```json
"title": "{{#equal receiver.language \"pl\"}}Nowa wiadomość od {{ sender.name }}{{else}}New message from {{ sender.name }}{{/equal}}"
```

Limits and notes:

- **Per-device language is not possible**: devices carry only token, provider, provider name, hardware id. The
  alternative is OS-side localization with `title-loc-key` / `loc-key` and `.strings` resources in the app bundle,
  which follows the device language, not the in-app `en`/`pl` choice. Not recommended.
- The body is the message text, which is user content and never translated. Only the title (and a fallback body, if
  we hide text) needs two strings.
- Missing fields render as empty strings (documented limitation 3), so an unset `language` falls to the `else` branch.
- Templates are stored per **provider and event type** (`push_provider_name` + `event_type`), so the same template is
  repeated for each provider (apn-dev, apn-prod, firebase).
- Stream also lists "Message Translations" under Elevate and "App Interface Localization" on all plans. Neither is the
  push-template mechanism above and neither is needed.

---

## 7. Push preferences for a single "Chat messages" toggle

[Push preferences](https://getstream.io/docs/platform/push-preferences/), `stream-chat@9.54.0`:
`client.setPushPreferences(preferences: PushPreference[])` → `POST /push_preferences`.

```ts
await client.setPushPreferences([{ user_id: userId, chat_level: 'none' }]) // off
await client.setPushPreferences([{ user_id: userId, chat_level: 'all' }])  // on
```

- Server-side calls "can update preferences for any user" (`user_id` required), client-side calls only the connected user's own.
- Levels: `all` (default), `all_mentions`, `direct_mentions`, `none`; legacy `mentions` means `direct_mentions`; `default`
  behaves as `all`. Also `disabled_until` (snooze) and `remove_disable`.
- Order of evaluation: channel-member preference, then user-level, then the channel config `push_level`, then `all`;
  `disabled_until` overrides everything while it is in the future. Because **we never set channel-member preferences**
  (except the defensive case in §8), the user-level value is what applies.
- `chat_level` and the granular `chat_preferences` object are mutually exclusive. We only need `chat_level`.
- **There is no server-side read endpoint** for push preferences in the REST definition (only `POST /push_preferences`; the
  response echoes `user_preferences`, and the connected client sees its own in `OwnUserResponse.push_preferences`).
  Keep the toggle's source of truth in Mongo (the notification-preferences slice already needs it for Expo) and write
  through to Stream on change. That also means the toggle works while the user has never connected.
- Does it back one toggle? Yes: one boolean maps to `all` or `none`. Mentions levels are not needed, since the app has
  no @mentions.
- Order of writes: `upsertUsers` first, then `setPushPreferences`. Whether a preference set before the user's first
  device/connection persists is expected but not stated (§11).

---

## 8. Secret threads and retired threads

### Delivery rule

[Push Delivery Rules](https://getstream.io/docs/platform/push-notifications/): "**Only channel members receive a push
notification.**" and "Push notifications require membership. Watching a channel isn't enough." Troubleshooting repeats
"The target user is a member of the channel that will send notifications." Nothing sends a push to a mentioned
non-member.

- **Secret threads.** The beneficiary is not a member (spec §2.4, ADR 0001: "the recipient is never a member of their
  own secret thread"), so Stream never selects them as a receiver. `@`-mentions, replies and reactions do not change that.
  The sender's name and the text are the only content in the default template. The default templates do not use
  `members` or `otherMembers`; do not add them to the secret-thread template.
- The server-created channel is owned by `prezentowo-server` (`CHAT_SERVER_USER_ID`), a user with no devices.
  Not a push risk.

### Retired threads: safe only while frozen

ADR 0001 keeps retired threads' members (so the person who must lose access, for example the new beneficiary after a
beneficiary change, is **still a member** of the retired thread). For the UI that is handled by only querying published
cids. **Push does not go through that filter.** If a message could still be posted in a retired thread, Stream would
push its text to a member whose client hides the thread.

- A frozen channel "prevents users from sending new messages and adding or deleting reactions", and only a role with
  `UseFrozenChannel` could bypass it, "By default, no user role has this permission"
  ([Freezing Channels](https://getstream.io/chat/docs/node/freezing-channels/)). Members therefore cannot create a push
  trigger after the freeze.
- The freeze is the **last** step of `syncEvent` in `chat.sync.ts`: "Last, as it only tidies up … Not retried if it
  fails; the client only shows the threads chatThreads.byEvent publishes anyway." That reasoning holds for the UI and
  **not for push**. Between the Mongo retirement and the freeze, and permanently if the freeze call fails, a message
  in the old thread would push its text to the person who just lost access (they are still a member). Cheap defence in depth: when retiring, also set a **channel-member
  preference** for the people who lose access, `setPushPreferences([{ user_id, channel_cid, chat_level: 'none' }])`
  (channel-member preferences take highest priority). It does not remove them from the channel, so ADR 0001 still holds.
- `freezeChannel` in `chat.server.ts` uses `updatePartial({ set: { frozen: true } })` with no message, so no system
  message exists to push. Keep it that way. `channel.update({ frozen: true }, { text: … })` posts a system message, and
  Stream documents that "Silent messages still trigger push notifications by default"; `skip_push` is documented on
  `sendMessage`, reactions and `truncate`, but not on channel `update`. Whether a system message pushes is not stated
  outright (§11). The same caution applies to `addMembers`/`removeMembers` with a message.
- Reactions and edits: not pushed unless `reaction.new` / `message.updated` templates are enabled, which we do not do.

### Content on the lock screen

Pushes carry the message text. For a gift-surprise app the lock screen is a leak path of its own (someone glancing at
the phone). The template can branch on `channel.type`, for example a generic body for `secret_thread`:

```handlebars
{{#equal channel.type "secret_thread"}}…New secret message{{else}}{{ truncate message.text 150 }}{{/equal}}
```

That is a product choice for the notifications slice. The mechanism exists.

---

## 9. Suppressing pushes while the app is in the foreground

- **Stream does not suppress by online state.** "If your app is created after 2022-01-18, push notifications are sent
  irrespective of online status and online users will [get] push notifications and it's a flexibility of your app to
  handle it or ignore it" ([push-troubleshooting](https://getstream.io/docs/platform/push-troubleshooting/)). Older
  apps had a one-minute lag before being treated as offline. Our app only holds a websocket while a chat screen is open,
  and Stream would push to it anyway.
- Stream's guide: "Both iOS and Android discard push notifications when your application is on the foreground … you can
  configure this", and "Most chat apps suppress foreground notifications".
- With `expo-notifications` it is `setNotificationHandler`. "When a notification is received while the app is running
  … the default behavior when the handler is not set or does not respond in time is not to show the notification."
  The handler must answer within 3 seconds. One handler serves both senders, so branch on the payload sender:

```ts
Notifications.setNotificationHandler({
  handleNotification: async n => {
    const isChat = senderOf(n) === 'stream.chat' // trigger.payload.stream.sender (iOS) | trigger.remoteMessage.data.sender (Android)
    return { shouldShowBanner: !isChat, shouldShowList: !isChat, shouldPlaySound: false, shouldSetBadge: false }
  },
})
```

- Per-platform behaviour from the Expo notification-types table: a notification message arriving in the foreground
  runs the listener and the handler; background and killed states are drawn by the OS with no JS. That is the same on
  iOS and (with the `android.notification` template) on Android.
- To suppress only the thread being read, compare `cid` with the open thread. This is JS-side and cannot be done in
  Stream. Suppress all chat pushes in the foreground first, and refine only if it feels wrong.
- Inbox pushes (Expo) in the foreground are a separate decision: the same handler governs them.

---

## 10. What this means for the spec and the other tickets

- Add `chat` push to the notification design as **Stream-native, server-registered**: `push.registerDevice` on our server
  stores the Expo token and the native token (with platform and APNs environment), calls Stream `addDevice` under the
  right provider name, and mirrors `chat_level` from the user's preference. Sign-out and user switch remove both.
  Offline sign-out cannot reach the server, so the server must also unbind when another account registers the same
  token and drop devices Stream reports as `disabled`.
- Spec §7 already says "`connectUser` runs only when `8a`/`8b` opens". Nothing in push changes that.
- `workspaces/types`: a registration method args type (native token, platform, APNs environment).
- One-time Stream configuration to script or document: providers (apn dev/prod, firebase), `message.new` template per
  provider (no badge, localized title, optional generic secret-thread body), `language` on upserted users.
- Retire flow: add the channel-member `none` preference for people who lose access, next to the freeze.

---

## 11. Not verified, and how to settle each

No Stream app was used. These need a short spike against a dev Stream app (an hour or two with a physical iPhone, or an
iOS Simulator, which Expo says supports push on Xcode 14+ / macOS 13+ / iOS 16+) or a question to Stream:

1. **Server-side `addDevice` for a user who never connected** actually delivers, and the same token under two user ids
   behaves (rejected, moved, or both). Documented only through the API definition.
2. **MAU impact** of server-side `addDevice` / `setPushPreferences` / `upsertUsers`. The billing article was unreadable
   (Cloudflare). Compare MAU on the dashboard before and after the spike, or ask `support@getstream.io`.
3. **`apn_development` semantics** and whether a team-scoped sandbox-only key plus a production key needs two providers
   (the plan above) or whether Stream picks the environment itself.
4. **Template details:** that extra top-level keys such as `"body": {…}` in the APNs payload are passed through; that
   `android.notification` without `click_action` shows and opens the launcher activity; that `receiver.language` really
   resolves a custom user field (the docs say any custom field; the only examples use `receiver.name`/`id`); that
   `{{#equal …}}` inside a JSON string renders valid JSON.
5. **App push version** is v3 (`getAppSettings().app.push_notifications.version`); `upsertPushProvider` needs v2 or later.
6. **Channel types `event_thread` and `secret_thread` report `push_notifications: true`** (`getChannelType`).
7. **`expo-notifications` handling of a Stream push on a real device**: `trigger.payload.stream` on iOS,
   `trigger.remoteMessage.data` on Android, the cold-start path (`useLastNotificationResponse`) and the foreground
   handler returning in under 3 seconds. Read from source for 57.0.22, not run.
8. **No published rate limits** for the device and preference endpoints in the docs read.
9. **Freeze gap:** that a message in a retired-but-unfrozen thread still pushes to a member who lost access, and
   whether a system message (from `update`/`addMembers` with a message) pushes. Inferred from the delivery rules, not
   observed.
10. **Push logs:** the Stream dashboard's "Webhook & Push Logs" (and `testPushSettings(userId, { skipDevices: true })`
    for a rendered payload without sending) are the tools to confirm 4 and 7.

---

## 12. Sources

Stream (all fetched 2026-10-09):

- Push overview, delivery rules, payload: <https://getstream.io/docs/platform/push-notifications/>
- Providers: <https://getstream.io/docs/platform/push-providers/>
- Devices: <https://getstream.io/docs/platform/push-devices/>
- Preferences: <https://getstream.io/docs/platform/push-preferences/>
- Troubleshooting and FAQ: <https://getstream.io/docs/platform/push-troubleshooting/>
- Templates and context variables: <https://getstream.io/chat/docs/node/push-template/>
- Legacy push system (v1/v2, version note): <https://getstream.io/chat/docs/node/legacy-push-system/>
- React Native push guide: <https://getstream.io/chat/docs/sdk/react-native/guides/push-notifications/>
- iOS push guide (multi-bundle APNs fields): <https://getstream.io/chat/docs/sdk/ios/guides/push-notifications/>
- Freezing channels, silent and system messages, channel types: <https://getstream.io/chat/docs/node/llms-full.txt>
- Pricing: <https://getstream.io/chat/pricing.md>
- Users (MAU for guests/anonymous): <https://getstream.io/docs/platform/users/>
- REST definition (`CreateDevice`, `DeleteDevice`, `UpsertPushTemplate`, `PushProviderRequest`, `PushPreferenceInput`):
  <https://github.com/GetStream/protocol/blob/main/openapi/chat-openapi.json>
- `stream-chat@9.54.0` (`src/client.ts`, `src/types.ts`) and `stream-chat-expo@9.9.2`, from npm.

Expo and Apple:

- `expo-notifications` SDK 57: <https://docs.expo.dev/versions/v57.0.0/sdk/notifications/>
- Notification types: <https://docs.expo.dev/push-notifications/what-you-need-to-know/>
- Setup and FCM credentials: <https://docs.expo.dev/push-notifications/push-notifications-setup/>,
  <https://docs.expo.dev/push-notifications/fcm-credentials/>
- `expo-notifications@57.0.22` from npm: `android/.../FirebaseMessagingDelegate.kt`, `RemoteNotificationContent.kt`,
  `NotificationData.kt`, `NotificationsHandler.kt`, `ExpoNotificationLifecycleListener.kt`;
  `ios/.../NotificationRecords.swift`, `NotificationsAppDelegateSubscriber.swift`; `plugin/src/withNotificationsIOS.ts`.
- Apple, token-based APNs connection:
  <https://developer.apple.com/documentation/usernotifications/establishing-a-token-based-connection-to-apns>
