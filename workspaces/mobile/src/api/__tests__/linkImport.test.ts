/// <reference types="jest" />
import { NetworkError } from '@/sync/errors'

import { blockedShopName, importLink } from '../linkImport'

const mockCall = jest.fn()
jest.mock('@/sync', () => ({
  ...jest.requireActual('@/sync/errors'),
  call: (...args: unknown[]) => mockCall(...args),
}))

beforeEach(() => mockCall.mockReset())

describe('importLink', () => {
  it('asks gifts.importLink for the trimmed link, allowing for a slow shop', async () => {
    const outcome = {
      outcome: 'success',
      fields: { url: 'https://shop.test/kettle', missing: [] },
    }
    mockCall.mockResolvedValue(outcome)

    await expect(importLink('  shop.test/kettle ')).resolves.toEqual(outcome)
    expect(mockCall).toHaveBeenCalledWith(
      'gifts.importLink',
      { url: 'shop.test/kettle' },
      { timeoutMs: 20_000 },
    )
  })

  it('passes an unreadable shop through, naming a blocked one', async () => {
    mockCall.mockResolvedValue({
      outcome: 'unreadable',
      blockedShop: 'allegro.pl',
    })

    await expect(importLink('allegro.pl/oferta/1')).resolves.toEqual({
      outcome: 'unreadable',
      blockedShop: 'allegro.pl',
    })
  })

  it('treats no answer from the server as an infra failure', async () => {
    mockCall.mockRejectedValue(new NetworkError('timeout', 'gifts.importLink'))

    await expect(importLink('shop.test/kettle')).resolves.toEqual({
      outcome: 'infra-failure',
    })
  })

  it('treats a link the server cannot parse as unreadable', async () => {
    mockCall.mockRejectedValue({ error: 'invalidArgs', reason: 'invalidUrl' })

    await expect(importLink('not a link')).resolves.toEqual({
      outcome: 'unreadable',
    })
  })

  it('treats any other refusal as an infra failure', async () => {
    mockCall.mockRejectedValue({
      error: 'notAuthorized',
      reason: 'mustBeLoggedIn',
    })

    await expect(importLink('shop.test/kettle')).resolves.toEqual({
      outcome: 'infra-failure',
    })
  })
})

describe('blockedShopName', () => {
  it('names the shops on the blocked list', () => {
    expect(blockedShopName('allegro.pl')).toBe('Allegro')
    expect(blockedShopName('mediaexpert.pl')).toBe('Media Expert')
  })

  it('falls back to the domain for a shop it has no name for', () => {
    expect(blockedShopName('zalando.pl')).toBe('zalando.pl')
  })
})
