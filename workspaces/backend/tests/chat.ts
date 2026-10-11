import type { ChatThreadDoc } from '@prezentowo/types'

import {
  type ChannelType,
  type ChatServer,
  DELETED_USER_NAME,
  setChatServer,
} from '../imports/api/chat/chat.server'

export type FakeChatCall =
  | { op: 'upsertUsers'; userIds: string[] }
  | { op: 'createChannel'; cid: string; members: string[]; createdById: string }
  | { op: 'addMembers'; cid: string; userIds: string[]; hideHistory: boolean }
  | { op: 'removeMembers'; cid: string; userIds: string[] }
  | { op: 'freezeChannel'; cid: string }
  | { op: 'anonymiseUser'; userId: string }
  | { op: 'deleteChannels'; cids: string[]; hardDelete: boolean }

type FakeChannel = {
  createdById: string
  members: Set<string>
  frozen?: boolean
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
  users = new Map<string, { name?: string; image?: string }>()
  failing = false

  reset() {
    this.calls = []
    this.channels.clear()
    this.users.clear()
    this.failing = false
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

  async upsertUsers(users: { id: string; name?: string }[]) {
    this.write()
    this.calls.push({ op: 'upsertUsers', userIds: users.map(u => u.id) })
    for (const { id, name } of users) this.users.set(id, { name })
  }

  async createChannel(
    type: ChannelType,
    id: string,
    data: { members: string[]; created_by_id: string },
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
    })
    this.channels.set(cid, {
      createdById: data.created_by_id,
      members: new Set(data.members),
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
