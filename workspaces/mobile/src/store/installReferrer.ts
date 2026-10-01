import { getInstallReferrerAsync } from 'expo-application'
import * as SecureStore from 'expo-secure-store'
import { Platform } from 'react-native'

import { offerPendingInvite } from './pendingInvite'

const READ_KEY = 'prezentowo.installReferrerRead'

// The `code` the landing page's Play Store button put in the referrer
// (`code=<code>`), among whatever else the Play Store adds. In practice it can
// arrive still percent-encoded as a whole.
function inviteCodeOf(referrer: string): string | null {
  let query = referrer
  if (!query.includes('=')) {
    try {
      query = decodeURIComponent(query)
    } catch {
      return null
    }
  }
  for (const pair of query.split('&')) {
    const [key, value = ''] = pair.split('=')
    if (key !== 'code') continue
    try {
      const code = decodeURIComponent(value)
      return /^[A-Za-z0-9]+$/.test(code) ? code : null
    } catch {
      return null
    }
  }
  return null
}

/**
 * Android's deferred deep link (docs/spec.md §4.3): someone who installed
 * from an invite's Play Store button gets that invite as the pending one, the
 * same hand-off as a signed-out `7a` Join. Reads the referrer once per
 * install, asking again next time if the Play Store couldn't answer; iOS has
 * no equivalent.
 */
export async function claimInstallReferrerInvite(): Promise<void> {
  if (Platform.OS !== 'android') return
  try {
    if ((await SecureStore.getItemAsync(READ_KEY)) !== null) return
    const referrer = await getInstallReferrerAsync()
    await SecureStore.setItemAsync(READ_KEY, '1')
    const code = inviteCodeOf(referrer)
    if (code) await offerPendingInvite({ code })
  } catch {
    // No Play Store, or it couldn't answer: no invite to pick up this time.
  }
}
