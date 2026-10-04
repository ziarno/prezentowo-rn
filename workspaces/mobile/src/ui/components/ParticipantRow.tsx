import { Pressable, View } from 'react-native'

import { ArrowRightIcon } from '@/components/ui/icon'
import { Text } from '@/components/ui/text'
import { garland } from '@/constants/colors'
import { ParticipantAvatar } from '@/ui/components/ParticipantAvatar'

type ParticipantRowProps = {
  name: string
  avatarKey?: string
  photo?: string
  color?: string
  subtitle?: string
  // How many presents are listed for this person; omitted where the count
  // isn't shown (e.g. non-beneficiaries in a many-to-one event, `3d2`).
  presentCount?: number
  isYou?: boolean
  youLabel?: string
  onPress?: () => void
}

export function ParticipantRow({
  name,
  avatarKey,
  photo,
  color,
  subtitle,
  presentCount,
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
        photo={photo}
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
        {subtitle ? (
          <Text className="mt-0.5 text-xs text-garland-ink-60">{subtitle}</Text>
        ) : null}
      </View>
      {presentCount !== undefined ? (
        <Text className="text-[13px] font-bold text-garland-ink-60">
          {presentCount}
        </Text>
      ) : null}
      <ArrowRightIcon width={20} height={20} color={garland.ink40} />
    </Pressable>
  )
}
