import { type MeteorError, isNetworkError } from '@/sync'

import i18n from './i18n'

// What to show for a failed call: a network message when the server couldn't
// be reached, otherwise the server's reason, otherwise `fallback`.
export function errorMessage(error: unknown, fallback: string): string {
  if (isNetworkError(error)) return i18n.t('common.networkError')
  const meteorError = error as Partial<MeteorError> | undefined
  return meteorError?.reason ?? meteorError?.error?.toString() ?? fallback
}
