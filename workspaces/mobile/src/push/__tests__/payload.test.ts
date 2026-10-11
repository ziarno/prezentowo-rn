/// <reference types="jest" />
import type { ChatThreadDoc } from '@prezentowo/types'

import {
  type PushNotification,
  chatPushTarget,
  createTappedPushes,
  foregroundBehavior,
  inboxPushTarget,
  publicationsFor,
  pushOf,
} from '../payload'

// What expo-notifications hands over: an Expo push's `data` lands in
// `content.data`; Stream's payload stays in the trigger.
const expoPush = (
  data: Record<string, unknown>,
  identifier = 'expo-1',
): PushNotification => ({
  request: {
    identifier,
    content: { data },
    trigger: { type: 'push', payload: { aps: {}, body: data } },
  },
})

const STREAM = {
  version: 'v2',
  sender: 'stream.chat',
  type: 'message.new',
  id: 'msg-1',
  cid: 'event_thread:abc',
  receiver_id: 'u1',
  eventId: 'e1',
}

const iosChatPush = (
  stream: Record<string, unknown> = STREAM,
  identifier = 'apns-1',
): PushNotification => ({
  request: {
    identifier,
    content: { data: {} },
    trigger: { type: 'push', payload: { aps: { alert: {} }, stream } },
  },
})

const androidChatPush = (
  data: Record<string, string> = { ...STREAM, channel_id: 'abc' },
  identifier = 'fcm-1',
): PushNotification => ({
  request: {
    identifier,
    content: { data: {} },
    trigger: { type: 'push', remoteMessage: { data } },
  },
})

const inbox = {
  notificationId: 'n1',
  kind: 'suggestion-claimed',
  eventId: 'e1',
  giftId: 'g1',
  recipientParticipantId: 'p2',
}

describe('pushOf', () => {
  it('reads an inbox push from its data', () => {
    expect(pushOf(expoPush(inbox))).toEqual({ kind: 'inbox', data: inbox })
  })

  it('keeps only the inbox fields it knows', () => {
    expect(
      pushOf(
        expoPush({
          notificationId: 'n1',
          kind: 'invited',
          eventId: 'e1',
          extra: 1,
        }),
      ),
    ).toEqual({
      kind: 'inbox',
      data: { notificationId: 'n1', kind: 'invited', eventId: 'e1' },
    })
  })

  it('ignores an inbox push of a kind that never pushes, or missing ids', () => {
    expect(pushOf(expoPush({ ...inbox, kind: 'invite-deferred' }))).toBeNull()
    expect(pushOf(expoPush({ ...inbox, kind: 'chat' }))).toBeNull()
    expect(pushOf(expoPush({ ...inbox, notificationId: undefined }))).toBeNull()
    expect(pushOf(expoPush({ ...inbox, eventId: 7 }))).toBeNull()
  })

  it('reads Stream’s payload from the trigger on iOS', () => {
    expect(pushOf(iosChatPush())).toEqual({
      kind: 'chat',
      eventId: 'e1',
      cid: 'event_thread:abc',
    })
  })

  it('reads Stream’s payload from the remote message on Android', () => {
    expect(pushOf(androidChatPush())).toEqual({
      kind: 'chat',
      eventId: 'e1',
      cid: 'event_thread:abc',
    })
  })

  it('ignores a chat payload that isn’t from Stream, or lacks its thread', () => {
    expect(pushOf(iosChatPush({ ...STREAM, sender: 'someone' }))).toBeNull()
    expect(pushOf(iosChatPush({ ...STREAM, cid: '' }))).toBeNull()
    expect(pushOf(androidChatPush({ ...STREAM, eventId: '' }))).toBeNull()
  })

  it('ignores anything else', () => {
    expect(pushOf(expoPush({}))).toBeNull()
    expect(
      pushOf({
        request: { identifier: 'x', content: { data: null }, trigger: null },
      }),
    ).toBeNull()
  })
})

describe('createTappedPushes', () => {
  const tapped = (notification: PushNotification) => ({
    notification,
    actionIdentifier: 'expo.modules.notifications.actions.DEFAULT',
  })

  it('opens each tapped push once, however often it’s reported', () => {
    const pushes = createTappedPushes()
    const response = tapped(iosChatPush())

    expect(pushes.take(response)).toEqual({
      kind: 'chat',
      eventId: 'e1',
      cid: 'event_thread:abc',
    })
    // A cold start reports the same tap twice: the last response, then the
    // listener.
    expect(pushes.take(response)).toBeNull()
  })

  it('opens an inbox notification once, even from a second push of it', () => {
    const pushes = createTappedPushes()
    expect(pushes.take(tapped(expoPush(inbox, 'expo-1')))).not.toBeNull()
    // Delivery is at-least-once: the same notification, another push.
    expect(pushes.take(tapped(expoPush(inbox, 'expo-2')))).toBeNull()
  })

  it('opens two chat pushes of the same thread', () => {
    const pushes = createTappedPushes()
    expect(pushes.take(tapped(iosChatPush(STREAM, 'a')))).not.toBeNull()
    expect(pushes.take(tapped(iosChatPush(STREAM, 'b')))).not.toBeNull()
  })

  it('ignores an action other than the tap itself', () => {
    const pushes = createTappedPushes()
    const response = { ...tapped(iosChatPush()), actionIdentifier: 'reply' }
    expect(pushes.take(response)).toBeNull()
  })

  it('ignores a push it can’t read', () => {
    const pushes = createTappedPushes()
    expect(pushes.take(tapped(expoPush({})))).toBeNull()
  })
})

describe('chatPushTarget', () => {
  const thread = (extra: Partial<ChatThreadDoc>): ChatThreadDoc => ({
    _id: 't',
    eventId: 'e1',
    kind: 'event',
    streamChannelType: 'event_thread',
    streamChannelId: 'abc',
    ...extra,
  })
  const threads = [
    thread({}),
    thread({
      _id: 's',
      kind: 'secret',
      recipientParticipantId: 'p2',
      streamChannelType: 'secret_thread',
      streamChannelId: 'def',
    }),
  ]

  it('opens the event thread', () => {
    expect(
      chatPushTarget(
        { kind: 'chat', eventId: 'e1', cid: 'event_thread:abc' },
        threads,
      ),
    ).toEqual({ pathname: '/event/[eventId]/chat', params: { eventId: 'e1' } })
  })

  it('opens a secret thread under its person', () => {
    expect(
      chatPushTarget(
        { kind: 'chat', eventId: 'e1', cid: 'secret_thread:def' },
        threads,
      ),
    ).toEqual({
      pathname: '/event/[eventId]/person/[participantId]/chat',
      params: { eventId: 'e1', participantId: 'p2' },
    })
  })

  it('opens nothing for a thread that isn’t published to the viewer', () => {
    expect(
      chatPushTarget(
        { kind: 'chat', eventId: 'e1', cid: 'secret_thread:old' },
        threads,
      ),
    ).toBeNull()
  })
})

describe('foregroundBehavior', () => {
  const shown = {
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }
  const hidden = {
    shouldShowBanner: false,
    shouldShowList: false,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }

  it('shows no inbox push: the bell updates live', () => {
    expect(foregroundBehavior(expoPush(inbox), null)).toEqual(hidden)
  })

  it('shows a chat push', () => {
    expect(foregroundBehavior(iosChatPush(), null)).toEqual(shown)
    expect(foregroundBehavior(androidChatPush(), 'event_thread:other')).toEqual(
      shown,
    )
  })

  it('shows no chat push for the thread on screen', () => {
    expect(foregroundBehavior(iosChatPush(), 'event_thread:abc')).toEqual(
      hidden,
    )
  })

  it('shows a push it can’t read', () => {
    expect(foregroundBehavior(expoPush({}), null)).toEqual(shown)
  })
})

describe('inboxPushTarget', () => {
  const known = { eventKnown: true, giftGone: false, recipientInEvent: true }
  const data = (extra: Record<string, unknown>) =>
    ({ notificationId: 'n1', eventId: 'e1', ...extra }) as never

  it('routes like the inbox row', () => {
    expect(
      inboxPushTarget(
        data({
          kind: 'suggestion-claimed',
          giftId: 'g1',
          recipientParticipantId: 'p2',
        }),
        known,
      ),
    ).toEqual({
      pathname: '/event/[eventId]/gift/[giftId]',
      params: { eventId: 'e1', giftId: 'g1' },
    })
    expect(
      inboxPushTarget(
        data({
          kind: 'suggestion-claimed',
          giftId: 'g1',
          recipientParticipantId: 'p2',
        }),
        { ...known, giftGone: true },
      ),
    ).toEqual({
      pathname: '/event/[eventId]/person/[participantId]',
      params: { eventId: 'e1', participantId: 'p2' },
    })
    expect(
      inboxPushTarget(data({ kind: 'participant-joined' }), known),
    ).toEqual({ pathname: '/event/[eventId]', params: { eventId: 'e1' } })
  })

  it('opens an invitation by the event’s current code', () => {
    expect(
      inboxPushTarget(data({ kind: 'invited' }), {
        ...known,
        eventKnown: false,
        inviteCode: 'Ab3x',
      }),
    ).toEqual({ pathname: '/e/[code]', params: { code: 'Ab3x' } })
    expect(
      inboxPushTarget(data({ kind: 'invited' }), {
        ...known,
        eventKnown: false,
      }),
    ).toBeNull()
  })

  it('opens nothing for an event the viewer has lost', () => {
    expect(
      inboxPushTarget(data({ kind: 'participant-joined' }), {
        ...known,
        eventKnown: false,
      }),
    ).toBeNull()
  })
})

describe('publicationsFor', () => {
  const inboxPush = (kind: string) =>
    ({
      kind: 'inbox',
      data: { notificationId: 'n1', kind, eventId: 'e1' },
    }) as never

  it('waits for the event’s threads for a chat push', () => {
    expect(
      publicationsFor({ kind: 'chat', eventId: 'e1', cid: 'event_thread:abc' }),
    ).toEqual([['chatThreads.byEvent', ['e1']]])
  })

  it('waits for what the inbox row’s routing reads', () => {
    expect(publicationsFor(inboxPush('invited'))).toEqual([
      ['invites.deferred', []],
    ])
    expect(publicationsFor(inboxPush('suggestion-claimed'))).toEqual([
      ['events.mine', []],
      ['gifts.byEvent', ['e1']],
    ])
    expect(publicationsFor(inboxPush('participant-joined'))).toEqual([
      ['events.mine', []],
    ])
  })
})
