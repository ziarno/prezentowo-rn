import { useEffect, useState } from 'react'

import { useOfflineSince } from '@/sync'

// How long the session may be down before the app says so. Every launch and
// every reconnect is briefly offline while the socket opens and the login
// resumes; that shouldn't flash the banner or dim the screen.
const GRACE_MS = 1500

// True once the server has been unreachable for a moment. The app is then
// showing what the offline cache holds, and online-only actions are off
// (docs/spec.md §6.3, §6.4). Measured from when the session went down, so a
// screen opened mid-outage agrees with the banner at once.
export function useOffline(): boolean {
  const since = useOfflineSince()
  const [now, setNow] = useState(() => Date.now())
  const remaining = since === null ? 0 : since + GRACE_MS - now

  useEffect(() => {
    if (since === null || remaining <= 0) return
    const timer = setTimeout(() => setNow(Date.now()), remaining)
    return () => clearTimeout(timer)
  }, [since, remaining])

  return since !== null && remaining <= 0
}
