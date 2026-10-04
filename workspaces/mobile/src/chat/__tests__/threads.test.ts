/// <reference types="jest" />
import type { ChatThreadDoc } from '@prezentowo/types'

import { cidOf, eventThreadOf, recapOf, secretThreadOf } from '../threads'

const eventThread: ChatThreadDoc = {
  _id: 't1',
  eventId: 'e1',
  kind: 'event',
  streamChannelType: 'event_thread',
  streamChannelId: 'abc',
}
const bartekThread: ChatThreadDoc = {
  _id: 't2',
  eventId: 'e1',
  kind: 'secret',
  recipientParticipantId: 'pBartek',
  streamChannelType: 'secret_thread',
  streamChannelId: 'def',
}
const threads = [eventThread, bartekThread]

describe('thread lookup', function () {
  it("finds the event's thread", function () {
    expect(eventThreadOf(threads)).toBe(eventThread)
    expect(eventThreadOf([bartekThread])).toBeUndefined()
  })

  it("finds a person's secret thread by their participant id", function () {
    expect(secretThreadOf(threads, 'pBartek')).toBe(bartekThread)
    // The viewer's own thread is never published, so it's never found.
    expect(secretThreadOf(threads, 'pOla')).toBeUndefined()
  })

  it('addresses a thread by its Stream cid', function () {
    expect(cidOf(bartekThread)).toBe('secret_thread:def')
  })
})

describe('recapOf', function () {
  const message = (
    id: string,
    userId: string,
    text: string,
    extra: Record<string, unknown> = {},
  ) => ({ id, type: 'regular', text, user: { id: userId }, ...extra })

  it("lists a channel's last messages oldest first, with who wrote them", function () {
    const recap = recapOf({
      messages: [
        message('m1', 'bartek', 'Lego?'),
        message('m2', 'ola', ' I got it '),
      ],
    })

    expect(recap).toEqual([
      { id: 'm1', userId: 'bartek', text: 'Lego?' },
      { id: 'm2', userId: 'ola', text: 'I got it' },
    ])
  })

  it('keeps only the last three', function () {
    const recap = recapOf({
      messages: ['m1', 'm2', 'm3', 'm4'].map(id => message(id, 'bartek', id)),
    })

    expect(recap.map(line => line.id)).toEqual(['m2', 'm3', 'm4'])
  })

  it('skips deleted and system messages', function () {
    const recap = recapOf({
      messages: [
        message('m1', 'bartek', 'gone', { type: 'deleted' }),
        message('m2', 'bartek', 'gone too', { deleted_at: '2026-10-01' }),
        message('m3', 'bartek', 'joined', { type: 'system' }),
        message('m4', 'bartek', 'hi'),
      ],
    })

    expect(recap.map(line => line.id)).toEqual(['m4'])
  })

  it('has no text for a message that is only attachments', function () {
    const recap = recapOf({
      messages: [message('m1', 'bartek', '', { attachments: [{}] })],
    })

    expect(recap).toEqual([{ id: 'm1', userId: 'bartek', text: null }])
  })

  it('is empty for a channel with no messages', function () {
    expect(recapOf({})).toEqual([])
  })
})
