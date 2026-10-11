import type { AppLanguage, ChatThreadDoc } from '@prezentowo/types'
import { existsSync } from 'fs'
import { Meteor } from 'meteor/meteor'
import { resolve } from 'path'
import { StreamChat } from 'stream-chat'

// What a deleted account's messages are shown under.
export const DELETED_USER_NAME = 'Deleted user'

export type ChannelType = ChatThreadDoc['streamChannelType']

// The Stream user every channel is created by. A channel's creator may read
// it, so it's never a participant; the hyphen keeps it apart from Meteor ids.
export const CHAT_SERVER_USER_ID = 'prezentowo-server'

// A Stream user as we upsert it. Stream replaces the whole user on an upsert,
// so every upsert carries all of it (docs/spec.md §2.4).
export type StreamUser = { id: string; name?: string; language?: AppLanguage }

// Stream's push provider types: APNs for iOS, Firebase for Android.
export type PushProviderType = 'apn' | 'firebase'

/**
 * The slice of Stream's server-side client the chat lifecycle uses. Kept
 * close to Stream's own calls so tests can check what reaches Stream, e.g.
 * `hide_history` and the channel's creator.
 */
export interface ChatServer {
  // The app's public key, which the client needs alongside its token.
  apiKey: string
  createToken(userId: string, exp: number, iat: number): string
  upsertUsers(users: StreamUser[]): Promise<void>
  createChannel(
    type: ChannelType,
    id: string,
    // `eventId` is custom data, so a chat push can open its thread (§2.5).
    data: { members: string[]; created_by_id: string; eventId: string },
  ): Promise<void>
  addMembers(
    type: ChannelType,
    id: string,
    userIds: string[],
    options: { hide_history: boolean },
  ): Promise<void>
  removeMembers(type: ChannelType, id: string, userIds: string[]): Promise<void>
  // Stops new messages; members keep reading the history.
  freezeChannel(type: ChannelType, id: string): Promise<void>
  // Renames a deleted account's user to "Deleted user" and clears its image.
  // The user is never deleted, so its messages stay (docs/spec.md §10.4).
  anonymiseUser(userId: string): Promise<void>
  deleteChannels(
    cids: string[],
    options: { hard_delete: boolean },
  ): Promise<void>
  // Registers a device's native token for `userId`, so Stream's chat pushes
  // reach it without the app ever connecting (docs/spec.md §2.5).
  addDevice(
    deviceToken: string,
    provider: PushProviderType,
    userId: string,
    providerName: string,
  ): Promise<void>
  // A device Stream doesn't have is no error.
  removeDevice(deviceToken: string, userId: string): Promise<void>
  setPushPreferences(
    preferences: { user_id: string; chat_level: 'all' | 'none' }[],
  ): Promise<void>
}

export const streamChatServer = (
  apiKey: string,
  apiSecret: string,
): ChatServer => {
  const client = new StreamChat(apiKey, apiSecret, { disableCache: true })
  return {
    apiKey,
    createToken: (userId, exp, iat) => client.createToken(userId, exp, iat),
    upsertUsers: async users => void (await client.upsertUsers(users)),
    createChannel: async (type, id, data) =>
      void (await client.channel(type, id, data).create()),
    addMembers: async (type, id, userIds, options) =>
      void (await client
        .channel(type, id)
        .addMembers(userIds, undefined, options)),
    removeMembers: async (type, id, userIds) =>
      void (await client.channel(type, id).removeMembers(userIds)),
    freezeChannel: async (type, id) =>
      void (await client
        .channel(type, id)
        .updatePartial({ set: { frozen: true } })),
    anonymiseUser: async userId =>
      void (await client.upsertUsers([
        { id: userId, name: DELETED_USER_NAME, image: '' },
      ])),
    deleteChannels: async (cids, options) =>
      void (await client.deleteChannels(cids, options)),
    addDevice: async (deviceToken, provider, userId, providerName) =>
      void (await client.addDevice(
        deviceToken,
        provider,
        userId,
        providerName,
      )),
    removeDevice: async (deviceToken, userId) => {
      try {
        await client.removeDevice(deviceToken, userId)
      } catch (error) {
        // A device Stream doesn't have is already removed, e.g. one whose
        // `addDevice` failed; otherwise its token could never be deleted.
        if ((error as { status?: number }).status !== 404) throw error
      }
    },
    setPushPreferences: async preferences =>
      void (await client.setPushPreferences(preferences)),
  }
}

// Meteor doesn't read `.env`; the backend keeps the Stream keys there in
// development (it's gitignored). `meteor run` keeps the PWD it was started
// from, which is the app directory.
const loadDotEnv = () => {
  const path = resolve(process.env.PWD ?? process.cwd(), '.env')
  if (existsSync(path)) process.loadEnvFile(path)
}

const fromEnvironment = (): ChatServer | null => {
  // Tests install their own; they never reach the real Stream app.
  if (Meteor.isTest || Meteor.isAppTest) return null
  loadDotEnv()
  const { STREAM_API_KEY, STREAM_API_SECRET } = process.env
  if (!STREAM_API_KEY || !STREAM_API_SECRET) {
    console.warn(
      'chat: STREAM_API_KEY / STREAM_API_SECRET not set, chat is off',
    )
    return null
  }
  return streamChatServer(STREAM_API_KEY, STREAM_API_SECRET)
}

let server: ChatServer | null | undefined

/** The Stream server client, or null when chat isn't configured. */
export function chatServer(): ChatServer | null {
  if (server === undefined) server = fromEnvironment()
  return server
}

/** Replaces the Stream client, e.g. with a test stub; null turns chat off. */
export function setChatServer(next: ChatServer | null) {
  server = next
}

// Reads the keys at startup, so a server without them says so straight away.
Meteor.startup(() => void chatServer())
