import { useTranslation } from 'react-i18next'
import { Pressable } from 'react-native'
import { LocalSvg } from 'react-native-svg/css'

import plusIconAsset from '@/assets/svg/plus-icon.svg'

// The dashed "+" circle that takes or picks a profile photo (§1.10). With no
// `size` it fills its slot, like an `AvatarTile`.
export function PhotoUploadTile({
  onPress,
  size,
}: {
  onPress: () => void
  size?: number
}) {
  const { t } = useTranslation()
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('photoPicker.upload')}
      className="aspect-square items-center justify-center rounded-full border-[1.5px] border-dashed border-[rgba(0,0,0,0.2)] bg-[rgba(0,0,0,0.02)] active:opacity-70"
      style={{ width: size ?? '100%' }}
    >
      <LocalSvg asset={plusIconAsset} width={20} height={20} />
    </Pressable>
  )
}
