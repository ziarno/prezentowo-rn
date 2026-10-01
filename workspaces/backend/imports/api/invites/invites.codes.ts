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

// Draws codes until `write` lands one, retrying a code the unique index on
// `code` rejects as taken, or one `write` turns down by returning false.
async function writeFreshCode(
  nextCode: () => string,
  write: (code: string) => Promise<boolean>,
): Promise<string> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const code = nextCode()
    try {
      if (await write(code)) return code
    } catch (error) {
      if (!isDuplicateCode(error)) throw error
    }
  }
  throw new Meteor.Error('serverError', 'inviteCodeExhausted')
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
  return writeFreshCode(nextCode, async code => {
    await Invites.insertAsync({
      code,
      eventId,
      ownerId,
      createdAt: new Date(),
    } as Parameters<typeof Invites.insertAsync>[0])
    return true
  })
}

/**
 * Gives the event's `InviteDoc` a fresh code in place and returns it. The old
 * code stops resolving the moment the write lands.
 */
export async function rotateInvite(
  eventId: string,
  nextCode: () => string = randomInviteCode,
): Promise<string> {
  const invite = await Invites.findOneAsync(
    { eventId },
    { fields: { code: 1 } },
  )
  if (!invite) throw new Meteor.Error('notFound', 'inviteNotFound')
  return writeFreshCode(
    nextCode,
    async code =>
      code !== invite.code &&
      (await Invites.updateAsync({ eventId }, { $set: { code } })) > 0,
  )
}
