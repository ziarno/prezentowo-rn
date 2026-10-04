/// <reference types="jest" />
import { NetworkError } from '@/sync'

import { rateLimitRetryMs } from '../peopleSearch'

describe('rateLimitRetryMs', () => {
  it('waits out the rate limit, as long as the server says', () => {
    const error = { error: 'too-many-requests', details: { timeToReset: 4200 } }

    expect(rateLimitRetryMs(error)).toBe(4200)
  })

  it('waits a moment when the server gives no time', () => {
    expect(rateLimitRetryMs({ error: 'too-many-requests' })).toBe(1000)
    expect(
      rateLimitRetryMs({
        error: 'too-many-requests',
        details: { timeToReset: 0 },
      }),
    ).toBe(1000)
  })

  it('is null for every other failure', () => {
    expect(rateLimitRetryMs({ error: 'notAuthorized' })).toBeNull()
    expect(
      rateLimitRetryMs(new NetworkError('timeout', 'users.search')),
    ).toBeNull()
    expect(rateLimitRetryMs(undefined)).toBeNull()
  })
})
