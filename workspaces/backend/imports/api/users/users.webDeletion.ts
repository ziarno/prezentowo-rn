import type { AppLanguage } from '@prezentowo/types'
import { Accounts } from 'meteor/accounts-base'
import { Email } from 'meteor/email'
import { Meteor } from 'meteor/meteor'
import { Random } from 'meteor/random'

import { deleteAccountFor } from './users.deleteAccount'

// Deleting an account from the web without the app (docs/spec.md §3.6): an
// emailed, single-use deletion token, separate from sign-in tokens.

const TOKEN_LIFETIME_MS = 60 * 60 * 1000
const REPEAT_WINDOW_MS = 60 * 1000
const IP_WINDOW_MS = 60 * 60 * 1000
const IP_CAP = 10

/** `services.accountDeletion` on a user: the one live deletion token. */
export type DeletionState = { hashedToken: string; createdAt: Date }
type DeletionUser = Meteor.User & {
  services?: { accountDeletion?: DeletionState }
}

// accounts-base has it; @types/meteor doesn't declare it.
const hashToken = (token: string) =>
  (
    Accounts as unknown as { _hashLoginToken: (token: string) => string }
  )._hashLoginToken(token)

// When each client address last asked, within the last hour. In memory: a
// restart forgets it, which only ever lets a few more through.
const requestsByIp = new Map<string, number[]>()

/** Forgets every client address's requests. For tests. */
export function resetDeletionLimits() {
  requestsByIp.clear()
}

// Counts a request from `ip`; false once it's past the hourly cap.
function withinIpCap(ip: string, now: number) {
  // Now and then, forget addresses that haven't asked for an hour.
  if (requestsByIp.size > 1000) {
    for (const [key, times] of requestsByIp) {
      if (times.every(at => now - at >= IP_WINDOW_MS)) requestsByIp.delete(key)
    }
  }
  const recent = (requestsByIp.get(ip) ?? []).filter(
    at => now - at < IP_WINDOW_MS,
  )
  recent.push(now)
  requestsByIp.set(ip, recent)
  return recent.length <= IP_CAP
}

const EMAIL_COPY: Record<
  AppLanguage,
  { subject: string; text: (link: string) => string }
> = {
  en: {
    subject: 'Delete your Prezentowo account',
    text: link =>
      [
        'Hi,',
        '',
        'Someone asked to delete your Prezentowo account from the website. To delete it, open this link and confirm:',
        link,
        '',
        'The link expires in 1 hour.',
        '',
        'If you didn’t ask for this, ignore it, your account is safe.',
        '',
        '— Prezentowo',
      ].join('\n'),
  },
  pl: {
    subject: 'Usuń konto w Prezentowo',
    text: link =>
      [
        'Cześć,',
        '',
        'Ktoś poprosił na stronie, żeby usunąć konto w Prezentowo. Aby je usunąć, otwórz ten link i potwierdź:',
        link,
        '',
        'Link wygaśnie za godzinę.',
        '',
        'Jeśli to nie Ty, zignoruj tę wiadomość, Twoje konto jest bezpieczne.',
        '',
        '— Prezentowo',
      ].join('\n'),
  },
}

/** The link a deletion email carries. */
export const deletionLink = (token: string) =>
  Meteor.absoluteUrl(`delete-account/${token}`)

/**
 * Answers "delete my account" for `email`, asked from `ip`. Issues a fresh
 * token and mails it when the address has an account, `ip` is under its
 * cap, and the account wasn't sent one in the last minute; otherwise does
 * nothing. Never creates a user. The caller answers the same either way.
 *
 * Resolves once the token is stored; the email is sent after, so a known
 * address takes no longer to answer than an unknown one.
 */
export async function requestAccountDeletion(
  email: unknown,
  lang: AppLanguage,
  ip: string,
  now = new Date(),
): Promise<void> {
  if (!withinIpCap(ip, now.getTime())) return
  if (typeof email !== 'string') return
  const address = email.trim()
  if (address === '' || address.length > 254) return

  const user = (await Accounts.findUserByEmail(address)) as
    | DeletionUser
    | null
    | undefined
  if (!user) return
  const last = user.services?.accountDeletion?.createdAt
  if (last && now.getTime() - last.getTime() < REPEAT_WINDOW_MS) return

  // One live token per user: a new one replaces the old.
  const token = Random.secret()
  const state: DeletionState = { hashedToken: hashToken(token), createdAt: now }
  await Meteor.users.updateAsync(user._id, {
    $set: { 'services.accountDeletion': state },
  })

  const to = user.emails!.find(
    e => e.address.toLowerCase() === address.toLowerCase(),
  )!.address
  const copy = EMAIL_COPY[lang]
  Email.sendAsync({
    to,
    from: Accounts.emailTemplates.from,
    subject: copy.subject,
    text: copy.text(deletionLink(token)),
  }).catch(error => console.error('Account deletion email failed', error))
}

/**
 * The account a live deletion token opens, with the address to show, or
 * null when the token is unknown, spent or over an hour old.
 */
export async function accountForDeletionToken(
  token: string,
  now = new Date(),
): Promise<{ userId: string; email: string } | null> {
  if (!token) return null
  const user = (await Meteor.users.findOneAsync(
    { 'services.accountDeletion.hashedToken': hashToken(token) },
    { fields: { emails: 1, 'services.accountDeletion': 1 } },
  )) as DeletionUser | undefined
  const createdAt = user?.services?.accountDeletion?.createdAt
  if (!user || !createdAt) return null
  if (now.getTime() - createdAt.getTime() >= TOKEN_LIFETIME_MS) return null
  return { userId: user._id, email: user.emails?.[0]?.address ?? '' }
}

/**
 * Deletes the account a live deletion token opens (docs/spec.md §10.4).
 * False when the token opens nothing. The token goes with the user
 * document, the last step, so it's spent only once the deletion finishes and
 * a run that dies half-way can be retried with the same link.
 */
export async function deleteAccountByToken(
  token: string,
  now = new Date(),
): Promise<boolean> {
  const account = await accountForDeletionToken(token, now)
  if (!account) return false
  await deleteAccountFor(account.userId)
  return true
}
