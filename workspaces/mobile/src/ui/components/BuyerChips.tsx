import { View } from 'react-native'

import { Text } from '@/components/ui/text'

// One `🛍` chip per person buying a present — buying isn't exclusive, so
// there can be several. Never rendered for the present's recipient.
export function BuyerChips({ names }: { names: string[] }) {
  return (
    <View className="flex-row flex-wrap gap-1.5">
      {names.map((name, i) => (
        <View
          key={`${i}-${name}`}
          className="flex-row items-center rounded-full bg-garland-paper2 px-2.5 py-1"
        >
          <Text className="text-[11px] font-bold text-garland-ink">
            🛍 {name}
          </Text>
        </View>
      ))}
    </View>
  )
}
