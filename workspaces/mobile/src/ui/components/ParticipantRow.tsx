import { Pressable, View } from 'react-native'

import { ArrowRightIcon } from '@/components/ui/icon'
import { Text } from '@/components/ui/text'
import { garland } from '@/constants/colors'
import { ParticipantAvatar } from '@/ui/components/ParticipantAvatar'

type ParticipantRowProps = {
  name: string
  avatarKey?: string
  color?: string
  subtitle: string
  isYou?: boolean
  youLabel?: string
  onPress?: () => void
}

export function ParticipantRow({
  name,
  avatarKey,
  color,
  subtitle,
  isYou = false,
  youLabel,
  onPress,
}: ParticipantRowProps) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-3.5 border-t border-garland-ink-08 px-[22px] py-3.5 active:opacity-70"
    >
      <ParticipantAvatar
        name={name}
        avatarKey={avatarKey}
        color={color}
        size={38}
      />
      <View className="min-w-0 flex-1">
        <View className="flex-row items-center gap-2">
          <Text className="text-[15px] font-bold text-garland-ink">{name}</Text>
          {isYou && youLabel ? (
            <Text
              className="text-[10px] font-bold uppercase text-garland-green"
              style={{ letterSpacing: 0.8 }}
            >
              {youLabel}
            </Text>
          ) : null}
        </View>
        <Text className="mt-0.5 text-xs text-garland-ink-60">{subtitle}</Text>
      </View>
      <ArrowRightIcon width={20} height={20} color={garland.ink40} />
    </Pressable>
  )
}
