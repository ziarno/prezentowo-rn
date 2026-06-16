import { View } from 'react-native'

import { Text } from '@/components/ui/text'
import { AVATAR_SOURCES, type AvatarKey, avatar } from '@/constants/avatars'
import { garland } from '@/constants/colors'
import { Avatar } from '@/ui/components/Avatar'

type ParticipantAvatarProps = {
  name: string
  avatarKey?: string
  // Placeholder accent color, used for the initial-circle fallback.
  color?: string
  size?: number
}

const isAvatarKey = (key: string | undefined): key is AvatarKey =>
  !!key && key in AVATAR_SOURCES

// Renders a participant's avatar image when one is known, otherwise a colored
// circle with their initial — used for placeholders not yet on Prezentowo.
export function ParticipantAvatar({
  name,
  avatarKey,
  color,
  size = 38,
}: ParticipantAvatarProps) {
  if (isAvatarKey(avatarKey)) {
    return <Avatar source={avatar(avatarKey)} size={size} />
  }
  return (
    <View
      className="items-center justify-center rounded-full"
      style={{
        width: size,
        height: size,
        backgroundColor: color ?? garland.moss,
      }}
    >
      <Text className="font-bold text-white" style={{ fontSize: size * 0.42 }}>
        {name.charAt(0).toUpperCase()}
      </Text>
    </View>
  )
}
