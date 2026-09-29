import { View } from 'react-native'

import { LockIcon } from '@/components/ui/icon'
import { Text } from '@/components/ui/text'
import { garland } from '@/constants/colors'

// A small boxed note about what stays hidden, and from whom.
export function LockNote({
  children,
  className = '',
}: {
  children: string
  className?: string
}) {
  return (
    <View
      className={`flex-row items-center gap-2.5 rounded-xl bg-garland-paper2 px-3.5 py-2.5 ${className}`}
    >
      <LockIcon width={14} height={14} color={garland.green} />
      <Text className="flex-1 text-xs leading-[17px] text-garland-ink-60">
        {children}
      </Text>
    </View>
  )
}
