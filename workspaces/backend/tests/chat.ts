import type { AppLanguage, ChatThreadDoc } from '@prezentowo/types'
import { Meteor } from 'meteor/meteor'

import {
  type ChannelType,
  type ChatServer,
  DELETED_USER_NAME,
  type PushProviderType,
  type StreamUser,
  setChatServer,
} from '../imports/api/chat/chat.server'

export type FakeChatCall =
  | { op: 'upsertUsers'; userIds: string[] }
  | {
      op: 'createChannel'
      cid: string
      members: string[]
      createdById: string
      eventId: string
    }
  | { op: 'addMembers'; cid: string; userIds: string[]; hideHistory: boolean }
  | { op: 'removeMembers'; cid: string; userIds: string[] }
  | { op: 'freezeChannel'; cid: string }
  | { op: 'anonymiseUser'; userId: string }
  | { op: 'deleteChannels'; cids: string[]; hardDelete: boolean }
  | {
      op: 'addDevice'
      deviceToken: string
      provider: PushProviderType
      userId: string
      providerName: string
    }
  | { op: 'removeDevice'; deviceToken: string; userId: string }
  | {
      op: 'setPushPreferences'
      userId: string
      chatLevel: 'all' | 'none'
      // A channel-member preference; a user-level one has none.
      cid?: string
    }

type FakeChannel = {
  createdById: string
  members: Set<string>
  eventId: string
  frozen?: boolean
}

type FakeDevice = {
  userId: string
  provider: PushProviderType
  providerName: string
}

/**
 * An in-memory Stream server: records every call and keeps channels and
 * users, refusing what Stream refuses (unknown users, a channel that's
 * missing or already there). `failing` makes every write reject.
 */
export class FakeChatServer implements ChatServer {
  apiKey = 'fake-api-key'
  calls: FakeChatCall[] = []
  channels = new Map<string, FakeChannel>()
  users = new Map<
    string,
    { name?: string; image?: string; language?: AppLanguage }
  >()
  // By native token: a token belongs to one user at a time.
  devices = new Map<string, FakeDevice>()
  chatLevels = new Map<string, 'all' | 'none'>()
  // By cid, then user id.
  channelChatLevels = new Map<string, Map<string, 'all' | 'none'>>()
  failing = false

  reset() {
    this.calls = []
    this.channels.clear()
    this.users.clear()
    this.devices.clear()
    this.chatLevels.clear()
    this.channelChatLevels.clear()
    this.failing = false
  }

  /** The native tokens Stream holds for `userId`. */
  devicesOf(userId: string) {
    return [...this.devices]
      .filter(([, device]) => device.userId === userId)
      .map(([token]) => token)
      .sort()
  }

  /** The members of the channel backing `thread`. */
  membersOf(
    thread: Pick<ChatThreadDoc, 'streamChannelType' | 'streamChannelId'>,
  ) {
    const cid = `${thread.streamChannelType}:${thread.streamChannelId}`
    const channel = this.channels.get(cid)
    if (!channel) throw new Error(`No channel ${cid}`)
    return [...channel.members].sort()
  }

  /** Whether the channel backing `thread` is frozen. */
  isFrozen(
    thread: Pick<ChatThreadDoc, 'streamChannelType' | 'streamChannelId'>,
  ) {
    const cid = `${thread.streamChannelType}:${thread.streamChannelId}`
    return this.channel(cid).frozen === true
  }

  /** `userId`'s chat push level on the channel backing `thread`, if set. */
  chatLevelIn(
    thread: Pick<ChatThreadDoc, 'streamChannelType' | 'streamChannelId'>,
    userId: string,
  ) {
    const cid = `${thread.streamChannelType}:${thread.streamChannelId}`
    return this.channelChatLevels.get(cid)?.get(userId)
  }

  createToken(userId: string, exp: number, iat: number) {
    return JSON.stringify({ userId, exp, iat })
  }

  private write() {
    if (this.failing) throw new Error('Stream is unreachable')
  }

  private assertUsers(userIds: string[]) {
    const unknown = userIds.filter(id => !this.users.has(id))
    if (unknown.length) throw new Error(`Unknown users: ${unknown.join()}`)
  }

  private channel(cid: string) {
    const channel = this.channels.get(cid)
    if (!channel) throw new Error(`No channel ${cid}`)
    return channel
  }

  // Replaces each user whole, as Stream does.
  async upsertUsers(users: StreamUser[]) {
    this.write()
    this.calls.push({ op: 'upsertUsers', userIds: users.map(u => u.id) })
    for (const { id, name, language } of users) {
      this.users.set(id, { name, ...(language ? { language } : {}) })
    }
  }

  async createChannel(
    type: ChannelType,
    id: string,
    data: { members: string[]; created_by_id: string; eventId: string },
  ) {
    this.write()
    const cid = `${type}:${id}`
    if (this.channels.has(cid)) throw new Error(`Channel ${cid} exists`)
    this.assertUsers([...data.members, data.created_by_id])
    this.calls.push({
      op: 'createChannel',
      cid,
      members: [...data.members],
      createdById: data.created_by_id,
      eventId: data.eventId,
    })
    this.channels.set(cid, {
      createdById: data.created_by_id,
      members: new Set(data.members),
      eventId: data.eventId,
    })
  }

  async addMembers(
    type: ChannelType,
    id: string,
    userIds: string[],
    options: { hide_history: boolean },
  ) {
    this.write()
    const cid = `${type}:${id}`
    const channel = this.channel(cid)
    this.assertUsers(userIds)
    this.calls.push({
      op: 'addMembers',
      cid,
      userIds: [...userIds],
      hideHistory: options.hide_history,
    })
    for (const userId of userIds) channel.members.add(userId)
  }

  async removeMembers(type: ChannelType, id: string, userIds: string[]) {
    this.write()
    const cid = `${type}:${id}`
    const channel = this.channel(cid)
    this.calls.push({ op: 'removeMembers', cid, userIds: [...userIds] })
    for (const userId of userIds) channel.members.delete(userId)
  }

  async freezeChannel(type: ChannelType, id: string) {
    this.write()
    const cid = `${type}:${id}`
    const channel = this.channel(cid)
    this.calls.push({ op: 'freezeChannel', cid })
    channel.frozen = true
  }

  async anonymiseUser(userId: string) {
    this.write()
    this.calls.push({ op: 'anonymiseUser', userId })
    this.users.set(userId, { name: DELETED_USER_NAME, image: '' })
  }

  async deleteChannels(cids: string[], options: { hard_delete: boolean }) {
    this.write()
    this.calls.push({
      op: 'deleteChannels',
      cids: [...cids],
      hardDelete: options.hard_delete,
    })
    for (const cid of cids) this.channels.delete(cid)
  }

  async addDevice(
    deviceToken: string,
    provider: PushProviderType,
    userId: string,
    providerName: string,
  ) {
    this.write()
    this.assertUsers([userId])
    this.calls.push({
      op: 'addDevice',
      deviceToken,
      provider,
      userId,
      providerName,
    })
    this.devices.set(deviceToken, { userId, provider, providerName })
  }

  // A device that isn't there is no error.
  async removeDevice(deviceToken: string, userId: string) {
    this.write()
    this.calls.push({ op: 'removeDevice', deviceToken, userId })
    if (this.devices.get(deviceToken)?.userId === userId) {
      this.devices.delete(deviceToken)
    }
  }

  async setPushPreferences(
    preferences: {
      user_id: string
      channel_cid?: string
      chat_level: 'all' | 'none'
    }[],
  ) {
    this.write()
    this.assertUsers(preferences.map(p => p.user_id))
    for (const { channel_cid } of preferences) {
      if (channel_cid) this.channel(channel_cid)
    }
    for (const { user_id, channel_cid, chat_level } of preferences) {
      this.calls.push({
        op: 'setPushPreferences',
        userId: user_id,
        chatLevel: chat_level,
        ...(channel_cid ? { cid: channel_cid } : {}),
      })
      if (!channel_cid) {
        this.chatLevels.set(user_id, chat_level)
        continue
      }
      const levels = this.channelChatLevels.get(channel_cid) ?? new Map()
      levels.set(user_id, chat_level)
      this.channelChatLevels.set(channel_cid, levels)
    }
  }
}

// What settings.json names the providers.
export const FAKE_PUSH_PROVIDERS = {
  apn: { development: 'apn-dev', production: 'apn-prod' },
  firebase: 'firebase',
}

/**
 * Names Stream's push providers in `Meteor.settings` for the enclosing
 * `describe`, as settings.json does.
 */
export function useStreamPushProviders() {
  let saved: unknown
  before(function () {
    saved = Meteor.settings.stream
    Meteor.settings.stream = { pushProviders: FAKE_PUSH_PROVIDERS }
  })
  after(function () {
    Meteor.settings.stream = saved
  })
}

/**
 * Installs a fresh `FakeChatServer` as the Stream client for each test in
 * the enclosing `describe`, and turns chat back off afterwards.
 */
export function useFakeChatServer() {
  const fake = new FakeChatServer()
  beforeEach(function () {
    fake.reset()
    setChatServer(fake)
  })
  afterEach(function () {
    setChatServer(null)
  })
  return fake
}
