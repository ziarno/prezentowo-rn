import { View } from 'react-native'

import { uploadImageUrl } from '@/api/images'
import { Text } from '@/components/ui/text'
import { avatar, isAvatarKey } from '@/constants/avatars'
import { garland } from '@/constants/colors'
import { Avatar } from '@/ui/components/Avatar'

type ParticipantAvatarProps = {
  name: string
  avatarKey?: string
  // An upload id: a real user's photo, shown instead of `avatarKey`.
  photo?: string
  // Placeholder accent color, used for the initial-circle fallback.
  color?: string
  size?: number
}

// Renders a participant's photo or stock avatar when one is known, otherwise
// a colored circle with their initial — used for placeholders not yet on
// Prezentowo.
export function ParticipantAvatar({
  name,
  avatarKey,
  photo,
  color,
  size = 38,
}: ParticipantAvatarProps) {
  if (photo) {
    return <Avatar source={{ uri: uploadImageUrl(photo, 400) }} size={size} />
  }
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
