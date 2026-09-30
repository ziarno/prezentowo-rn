import { useLocalSearchParams } from 'expo-router'

import { InviteScreen } from '@/ui/screens/InviteScreen'

export default function InviteRoute() {
  const { code } = useLocalSearchParams<{ code: string }>()
  // Keyed so a second invite link opened over this one starts fresh.
  return <InviteScreen key={code} code={code} />
}
