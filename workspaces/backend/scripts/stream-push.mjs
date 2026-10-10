#!/usr/bin/env node
// Sets up Stream's chat push (docs/spec.md §2.5): the two APNs providers and
// the Firebase one, and the `message.new` template each of them sends. Run
// from workspaces/backend, which keeps STREAM_API_KEY / STREAM_API_SECRET in
// its gitignored .env:
//
//   node scripts/stream-push.mjs \
//     --apn-key ~/secrets/AuthKey_XXXX.p8 --apn-key-id XXXX --apn-team-id W6YK2T46G3 \
//     --firebase-credentials ~/secrets/firebase-adminsdk.json
//
//   node scripts/stream-push.mjs --templates-only   # after editing a template
//
// Credentials go from the files straight to Stream; nothing is printed or
// written back. Safe to re-run: providers and templates are upserts.
import { existsSync, readFileSync } from 'fs'
import { homedir } from 'os'
import { resolve } from 'path'
import { StreamChat } from 'stream-chat'
import { parseArgs } from 'util'

const PROVIDERS = {
  apnDev: 'apn-dev', // sandbox tokens, from dev builds
  apnProd: 'apn-prod',
  firebase: 'firebase',
}
const BUNDLE_ID = 'com.prezentowo.app'
// The channel types chat.server.ts creates (ChatThreadDoc['streamChannelType']).
const CHANNEL_TYPES = ['event_thread', 'secret_thread']

// Handlebars renders the template text first; only the result has to be JSON,
// so the quotes inside {{ }} stay as they are. The receiver's Stream user
// carries `language` ('en' | 'pl'); a user without one gets English.
const title =
  '{{#equal receiver.language "pl"}}Nowa wiadomość od {{ sender.name }}' +
  '{{else}}New message from {{ sender.name }}{{/equal}}'
const body =
  '{{#if message.text}}{{ truncate message.text 150 }}' +
  '{{else}}{{#equal receiver.language "pl"}}Zdjęcie{{else}}Photo{{/equal}}{{/if}}'

// No badge anywhere: the app-icon badge is the inbox's (ADR 0006).
// `eventId` is the channel's custom field, so a tap can find its thread.
const APN_TEMPLATE = `{
  "payload": {
    "aps": {
      "alert": { "title": "${title}", "body": "${body}" },
      "sound": "default",
      "mutable-content": 1,
      "content-available": 0
    },
    "stream": {
      "version": "v2",
      "sender": "stream.chat",
      "type": "{{ event_type }}",
      "id": "{{ message.id }}",
      "cid": "{{ channel.cid }}",
      "receiver_id": "{{ receiver.id }}",
      "eventId": "{{ channel.eventId }}"
    }
  }
}`

// The notification block makes Android draw it; Stream's default is data-only,
// which shows nothing. No click_action: the launcher intent opens the app.
const FIREBASE_TEMPLATE = `{
  "data": {
    "version": "v2",
    "sender": "stream.chat",
    "type": "{{ event_type }}",
    "id": "{{ message.id }}",
    "message_id": "{{ message.id }}",
    "channel_type": "{{ channel.type }}",
    "channel_id": "{{ channel.id }}",
    "cid": "{{ channel.cid }}",
    "receiver_id": "{{ receiver.id }}",
    "eventId": "{{ channel.eventId }}"
  },
  "android": {
    "priority": "high",
    "notification": { "title": "${title}", "body": "${body}", "sound": "default" }
  }
}`

const { values: args } = parseArgs({
  options: {
    'apn-key': { type: 'string' },
    'apn-key-id': { type: 'string' },
    'apn-team-id': { type: 'string' },
    'firebase-credentials': { type: 'string' },
    'templates-only': { type: 'boolean', default: false },
  },
})

const readFile = path =>
  readFileSync(resolve(path.replace(/^~/, homedir())), 'utf8')

const fail = message => {
  console.error(`stream-push: ${message}`)
  process.exit(1)
}

// A rejected request carries its body, credentials included, so only the
// message is ever printed. A rejected top-level await lands here.
process.on('uncaughtException', error => fail(error?.message ?? 'failed'))

const envPath = resolve(process.cwd(), '.env')
if (existsSync(envPath)) process.loadEnvFile(envPath)
const { STREAM_API_KEY, STREAM_API_SECRET } = process.env
if (!STREAM_API_KEY || !STREAM_API_SECRET)
  fail(
    'STREAM_API_KEY / STREAM_API_SECRET not set (run from workspaces/backend)',
  )

const client = new StreamChat(STREAM_API_KEY, STREAM_API_SECRET, {
  disableCache: true,
})

const { app } = await client.getAppSettings()
const version = app.push_notifications?.version
console.log(`push version: ${version ?? 'unknown'}`)
if (version && version !== 'v3')
  fail(
    'named push providers need push v3; upgrade it in the Stream dashboard first',
  )

if (!args['templates-only']) {
  const missing = [
    'apn-key',
    'apn-key-id',
    'apn-team-id',
    'firebase-credentials',
  ]
    .filter(name => !args[name])
    .map(name => `--${name}`)
  if (missing.length) fail(`missing ${missing.join(', ')}`)

  const apn = development => ({
    type: 'apn',
    name: development ? PROVIDERS.apnDev : PROVIDERS.apnProd,
    apn_auth_type: 'token',
    apn_auth_key: readFile(args['apn-key']),
    apn_key_id: args['apn-key-id'],
    apn_team_id: args['apn-team-id'],
    apn_topic: BUNDLE_ID,
    apn_development: development,
  })
  await client.upsertPushProvider(apn(true))
  await client.upsertPushProvider(apn(false))
  await client.upsertPushProvider({
    type: 'firebase',
    name: PROVIDERS.firebase,
    firebase_credentials: readFile(args['firebase-credentials']),
  })
  console.log(`providers: ${Object.values(PROVIDERS).join(', ')}`)
}

const templates = [
  ['apn', PROVIDERS.apnDev, APN_TEMPLATE],
  ['apn', PROVIDERS.apnProd, APN_TEMPLATE],
  ['firebase', PROVIDERS.firebase, FIREBASE_TEMPLATE],
]
for (const [type, name, template] of templates) {
  // stream-chat has no helper for this endpoint (UpsertPushTemplate).
  await client.post(`${client.baseURL}/push_templates`, {
    enable_push: true,
    event_type: 'message.new',
    push_provider_type: type,
    push_provider_name: name,
    template,
  })
  console.log(`message.new template: ${name}`)
}

for (const type of CHANNEL_TYPES) {
  try {
    const channelType = await client.getChannelType(type)
    console.log(
      `channel type ${type}: push_notifications=${channelType.push_notifications}`,
    )
  } catch (error) {
    console.warn(`channel type ${type}: ${error.message}`)
  }
}
