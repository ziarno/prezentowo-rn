import type { ChatThreadDoc } from '@prezentowo/types'
import { existsSync } from 'fs'
import { Meteor } from 'meteor/meteor'
import { resolve } from 'path'
import { StreamChat } from 'stream-chat'

export type ChannelType = ChatThreadDoc['streamChannelType']

// The Stream user every channel is created by. A channel's creator may read
// it, so it's never a participant; the hyphen keeps it apart from Meteor ids.
export const CHAT_SERVER_USER_ID = 'prezentowo-server'

/**
 * The slice of Stream's server-side client the chat lifecycle uses. Kept
 * close to Stream's own calls so tests can check what reaches Stream, e.g.
 * `hide_history` and the channel's creator.
 */
export interface ChatServer {
  // The app's public key, which the client needs alongside its token.
  apiKey: string
  createToken(userId: string, exp: number, iat: number): string
  upsertUsers(users: { id: string; name?: string }[]): Promise<void>
  createChannel(
    type: ChannelType,
    id: string,
    data: { members: string[]; created_by_id: string },
  ): Promise<void>
  addMembers(
    type: ChannelType,
    id: string,
    userIds: string[],
    options: { hide_history: boolean },
  ): Promise<void>
  removeMembers(type: ChannelType, id: string, userIds: string[]): Promise<void>
  deleteChannels(
    cids: string[],
    options: { hard_delete: boolean },
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
    deleteChannels: async (cids, options) =>
      void (await client.deleteChannels(cids, options)),
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
