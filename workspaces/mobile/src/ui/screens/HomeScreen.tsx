import { Trans } from '@lingui/react/macro'
import { View } from 'react-native'

import { Text } from '@/components/ui/text'

export function HomeScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Text size="2xl" bold>
        <Trans>You&apos;re logged in!</Trans>
      </Text>
    </View>
  )
}
