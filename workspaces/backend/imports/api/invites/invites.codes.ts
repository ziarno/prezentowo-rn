import { randomInt } from 'crypto'
import { Meteor } from 'meteor/meteor'

import { Invites } from './invites.collection'

// [A-Za-z0-9] minus the look-alikes 0 O 1 l I: 57 symbols.
export const INVITE_CODE_ALPHABET =
  'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'

const CODE_LENGTH = 4

// 57^4 ≈ 10.6M codes, so a collision is rare until there are hundreds of
// thousands of events; a handful of retries only guards the unlucky draw.
const MAX_ATTEMPTS = 5

export const randomInviteCode = () =>
  Array.from(
    { length: CODE_LENGTH },
    () => INVITE_CODE_ALPHABET[randomInt(INVITE_CODE_ALPHABET.length)],
  ).join('')

const isDuplicateCode = (error: unknown) => {
  const { code, keyPattern } = (error ?? {}) as {
    code?: unknown
    keyPattern?: Record<string, unknown>
  }
  return code === 11000 && !!keyPattern && 'code' in keyPattern
}

/**
 * Inserts the event's `InviteDoc` and returns its code. The unique index on
 * `code` decides collisions, so a taken code is retried with a fresh one.
 */
export async function insertInvite(
  eventId: string,
  ownerId: string,
  nextCode: () => string = randomInviteCode,
): Promise<string> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const code = nextCode()
    try {
      await Invites.insertAsync({
        code,
        eventId,
        ownerId,
        createdAt: new Date(),
      } as Parameters<typeof Invites.insertAsync>[0])
      return code
    } catch (error) {
      if (!isDuplicateCode(error)) throw error
    }
  }
  throw new Meteor.Error('serverError', 'inviteCodeExhausted')
}
