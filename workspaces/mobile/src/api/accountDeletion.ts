import {
  ACCOUNT_DELETION_CONSEQUENCES,
  type AppLanguage,
  type DeleteAccountArgs,
} from '@prezentowo/types'

import { call } from '@/sync'

// Online-only, never queued (docs/spec.md §10.4). Rejects with
// `emailMismatch` when the address isn't the account's.
export function deleteAccount(email: string): Promise<void> {
  return call('users.deleteAccount', { email } satisfies DeleteAccountArgs)
}

// The server's answer when the address isn't the account's.
export function isEmailMismatch(error: unknown): boolean {
  return (error as { reason?: unknown } | undefined)?.reason === 'emailMismatch'
}

// The confirm's check, the same as the server's: case and surrounding spaces
// don't count.
export function emailMatches(typed: string, email: string | undefined) {
  const normalized = typed.trim().toLowerCase()
  return normalized !== '' && normalized === email?.trim().toLowerCase()
}

// The shared consequence list, in the app's language.
export function deletionConsequences(language: string): readonly string[] {
  return (
    ACCOUNT_DELETION_CONSEQUENCES[language as AppLanguage] ??
    ACCOUNT_DELETION_CONSEQUENCES.en
  )
}
