import { ImageUploadError } from '@/api/images'
import { type MeteorError, isNetworkError } from '@/sync'

import i18n from './i18n'

// What to show for a failed call or upload: a network message when the
// server couldn't be reached, the upload's own message, otherwise the
// server's reason, otherwise `fallback`.
export function errorMessage(error: unknown, fallback: string): string {
  if (isNetworkError(error)) return i18n.t('common.networkError')
  if (error instanceof ImageUploadError) {
    return i18n.t(`images.uploadErrors.${error.code}`)
  }
  const meteorError = error as Partial<MeteorError> | undefined
  return meteorError?.reason ?? meteorError?.error?.toString() ?? fallback
}
