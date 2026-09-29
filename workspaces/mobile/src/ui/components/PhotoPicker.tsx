import * as ImagePicker from 'expo-image-picker'
import { type ReactNode, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { View } from 'react-native'

import type { DraftImage } from '@/api/draftImage'
import { CameraIcon, CloseIcon, PhotoIcon } from '@/components/ui/icon'
import { Text } from '@/components/ui/text'
import { garland } from '@/constants/colors'
import { GarlandButton, GarlandButtonText } from '@/ui/components/GarlandButton'

type PickerError = 'cameraDenied' | 'cameraUnavailable' | 'libraryFailed'

// `4c` and `5b`: take a photo or pick one from the library (either replaces
// the current one), or remove it. The pick stays on the device (a `local`
// image) until the wizard saves, which uploads it.
export function PhotoPicker({
  value,
  onChange,
  preview,
}: {
  value: DraftImage | undefined
  onChange: (image: DraftImage | undefined) => void
  // How the current value looks where it will be shown.
  preview: ReactNode
}) {
  const { t } = useTranslation()
  const [error, setError] = useState<PickerError | null>(null)

  const choose = (result: ImagePicker.ImagePickerResult) => {
    const asset = result.canceled ? undefined : result.assets[0]
    if (asset) onChange({ kind: 'local', uri: asset.uri })
  }

  const takePhoto = async () => {
    setError(null)
    const permission = await ImagePicker.requestCameraPermissionsAsync()
    if (!permission.granted) {
      setError('cameraDenied')
      return
    }
    try {
      choose(await ImagePicker.launchCameraAsync({ mediaTypes: ['images'] }))
    } catch {
      // The iOS Simulator, for one, has no camera.
      setError('cameraUnavailable')
    }
  }

  const pickFromLibrary = async () => {
    setError(null)
    try {
      // The system picker needs no library permission.
      choose(
        await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'] }),
      )
    } catch {
      setError('libraryFailed')
    }
  }

  return (
    <View>
      <View className="items-center">{preview}</View>
      <View className="mt-4 flex-row gap-3">
        <View className="flex-1">
          <GarlandButton variant="outline" onPress={takePhoto}>
            <CameraIcon width={18} height={18} color={garland.ink} />
            <GarlandButtonText>{t('photoPicker.takePhoto')}</GarlandButtonText>
          </GarlandButton>
        </View>
        <View className="flex-1">
          <GarlandButton variant="outline" onPress={pickFromLibrary}>
            <PhotoIcon width={18} height={18} color={garland.ink} />
            <GarlandButtonText>
              {t('photoPicker.choosePhoto')}
            </GarlandButtonText>
          </GarlandButton>
        </View>
      </View>
      {value ? (
        <GarlandButton
          variant="link"
          onPress={() => {
            setError(null)
            onChange(undefined)
          }}
          className="mt-3 flex-row gap-1.5 self-center"
          hitSlop={10}
        >
          <CloseIcon width={14} height={14} color={garland.berry} />
          <GarlandButtonText className="font-semibold text-garland-berry">
            {t('photoPicker.remove')}
          </GarlandButtonText>
        </GarlandButton>
      ) : null}
      {error ? (
        <Text className="mt-3 text-center text-xs text-garland-berry">
          {t(`photoPicker.errors.${error}`)}
        </Text>
      ) : null}
    </View>
  )
}
