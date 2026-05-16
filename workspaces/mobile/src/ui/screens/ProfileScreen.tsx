import { Trans } from '@lingui/react/macro'
import { View } from 'react-native'

import { Text } from '@/components/ui/text'

export function ProfileScreen() {
  return (
    <View className="flex-1 bg-white p-6">
      <Text size="2xl" bold>
        <Trans>Profile</Trans>
      </Text>
    </View>
  )
}
