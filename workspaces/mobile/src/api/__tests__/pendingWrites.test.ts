import type { GiftDoc } from '@prezentowo/types'

import type { QueuedWrite } from '@/sync'

import {
  giftWrite,
  shownBuyers,
  waitingCount,
  withQueuedGifts,
} from '../pendingWrites'

const ME = 'user-me'

let seq = 0
const write = (
  method: string,
  args: object,
  overrides: Partial<QueuedWrite> = {},
): QueuedWrite => ({
  id: `w${++seq}`,
  method,
  args,
  state: 'pending',
  queuedAt: new Date(2026, 11, 1, 12, seq),
  ...overrides,
})

const add = (clientId: string, overrides: object = {}) =>
  write('gifts.add', {
    eventId: 'e1',
    forParticipantId: 'p-anna',
    title: 'Bike bell',
    clientId,
    ...overrides,
  })

const failed = (
  w: QueuedWrite,
  failure: QueuedWrite['failure'] = {
    error: 'notFound',
    reason: 'giftNotFound',
  },
): QueuedWrite => ({ ...w, state: 'failed', failure })

const gift = (overrides: Partial<GiftDoc> = {}): GiftDoc => ({
  _id: 'g1',
  eventId: 'e1',
  forParticipantId: 'p-anna',
  title: 'Kindle',
  claimedBy: [],
  createdBy: 'user-anna',
  createdAt: new Date(2026, 10, 1),
  ...overrides,
})

describe('withQueuedGifts', () => {
  it('shows an add queued for the event as the viewer’s gift, newest first', () => {
    const queued = add('c1', {
      description: 'Brass',
      image: { kind: 'local', uri: 'file:///bell.jpg' },
    })

    expect(withQueuedGifts([gift()], [queued], 'e1', ME)).toEqual([
      {
        _id: 'c1',
        eventId: 'e1',
        forParticipantId: 'p-anna',
        title: 'Bike bell',
        description: 'Brass',
        image: { kind: 'local', uri: 'file:///bell.jpg' },
        claimedBy: [],
        createdBy: ME,
        createdAt: queued.queuedAt,
      },
      gift(),
    ])
  })

  it('leaves out adds for other events, and claims', () => {
    expect(
      withQueuedGifts(
        [gift()],
        [add('c1', { eventId: 'e2' }), write('gifts.claim', { giftId: 'g1' })],
        'e1',
        ME,
      ),
    ).toEqual([gift()])
  })

  it('keeps a failed add', () => {
    expect(
      withQueuedGifts([], [failed(add('c1'))], 'e1', ME).map(g => g._id),
    ).toEqual(['c1'])
  })
})

describe('withQueuedGifts and a claim on a present since removed', () => {
  const claimOf = (g: GiftDoc) =>
    write('gifts.claim', { giftId: g._id }, { meta: { gift: g } })

  it('keeps the present in place once the claim failed', () => {
    const kindle = gift()
    expect(withQueuedGifts([], [failed(claimOf(kindle))], 'e1', ME)).toEqual([
      kindle,
    ])
  })

  it('shows the server’s copy while there is one', () => {
    const kindle = gift()
    const renamed = gift({ title: 'Kindle Paperwhite' })
    expect(
      withQueuedGifts([renamed], [failed(claimOf(kindle))], 'e1', ME),
    ).toEqual([renamed])
  })

  it('leaves out a claim still pending, and other events’ presents', () => {
    expect(withQueuedGifts([], [claimOf(gift())], 'e1', ME)).toEqual([])
    expect(
      withQueuedGifts([], [failed(claimOf(gift({ eventId: 'e2' })))], 'e1', ME),
    ).toEqual([])
  })
})

describe('giftWrite', () => {
  it('is the queued add of a gift shown from the queue', () => {
    const queued = add('c1')
    expect(giftWrite([queued], 'c1')).toEqual({
      id: queued.id,
      kind: 'add',
      state: 'pending',
    })
  })

  it('is the latest claim or unclaim of a gift', () => {
    const claim = write('gifts.claim', { giftId: 'g1' })
    const unclaim = failed(write('gifts.unclaim', { giftId: 'g1' }))
    const other = write('gifts.claim', { giftId: 'g2' })

    expect(giftWrite([claim, unclaim, other], 'g1')).toEqual({
      id: unclaim.id,
      kind: 'unclaim',
      state: 'failed',
      reason: 'giftNotFound',
    })
    expect(giftWrite([claim], 'g3')).toBeUndefined()
  })

  it('names the reasons the screens know, and `other` for the rest', () => {
    const reasonOf = (failure: QueuedWrite['failure']) =>
      giftWrite([failed(write('gifts.claim', { giftId: 'g1' }), failure)], 'g1')
        ?.reason

    expect(reasonOf({ error: 'notFound', reason: 'eventNotFound' })).toBe(
      'eventNotFound',
    )
    expect(
      reasonOf({ error: 'notAuthorized', reason: 'notAParticipant' }),
    ).toBe('notAParticipant')
    expect(reasonOf({ error: 'tooLarge' })).toBe('other')
    expect(reasonOf({ error: 'x', reason: 'toString' })).toBe('other')
  })
})

describe('shownBuyers', () => {
  const claimed = gift({ claimedBy: ['user-tomek', ME] })

  it('is who the server says is buying', () => {
    expect(shownBuyers(claimed, undefined, ME)).toEqual(['user-tomek', ME])
  })

  it('takes the viewer off for an unclaim waiting to send', () => {
    const unclaim = giftWrite([write('gifts.unclaim', { giftId: 'g1' })], 'g1')
    expect(shownBuyers(claimed, unclaim, ME)).toEqual(['user-tomek'])
  })

  it('keeps the viewer when that unclaim failed', () => {
    const unclaim = giftWrite(
      [failed(write('gifts.unclaim', { giftId: 'g1' }))],
      'g1',
    )
    expect(shownBuyers(claimed, unclaim, ME)).toEqual(['user-tomek', ME])
  })
})

describe('waitingCount', () => {
  it('counts the writes still waiting to send, not the failed ones', () => {
    expect(
      waitingCount([
        add('c1'),
        write('gifts.claim', { giftId: 'g1' }),
        failed(write('gifts.claim', { giftId: 'g2' })),
      ]),
    ).toBe(2)
  })
})
