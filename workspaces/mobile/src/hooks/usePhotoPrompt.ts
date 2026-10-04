import * as ImagePicker from 'expo-image-picker'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert } from 'react-native'

export type PhotoPromptError =
  | 'cameraDenied'
  | 'cameraUnavailable'
  | 'libraryFailed'

// "Take photo / Choose photo / Cancel", then the system camera or picker.
// `onPicked` gets the photo's local uri; nothing is uploaded here. `square`
// has the system picker crop it square (a profile photo, §1.10).
export function usePhotoPrompt(
  onPicked: (uri: string) => void,
  { square = false }: { square?: boolean } = {},
) {
  const { t } = useTranslation()
  const [error, setError] = useState<PhotoPromptError | null>(null)

  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    ...(square ? { allowsEditing: true, aspect: [1, 1] } : {}),
  }

  const choose = (result: ImagePicker.ImagePickerResult) => {
    const asset = result.canceled ? undefined : result.assets[0]
    if (asset) onPicked(asset.uri)
  }

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync()
    if (!permission.granted) {
      setError('cameraDenied')
      return
    }
    try {
      choose(await ImagePicker.launchCameraAsync(options))
    } catch {
      // The iOS Simulator, for one, has no camera.
      setError('cameraUnavailable')
    }
  }

  const pickFromLibrary = async () => {
    try {
      // The system picker needs no library permission.
      choose(await ImagePicker.launchImageLibraryAsync(options))
    } catch {
      setError('libraryFailed')
    }
  }

  const prompt = () => {
    setError(null)
    Alert.alert(t('photoPicker.upload'), undefined, [
      { text: t('photoPicker.takePhoto'), onPress: takePhoto },
      { text: t('photoPicker.choosePhoto'), onPress: pickFromLibrary },
      { text: t('photoPicker.cancel'), style: 'cancel' },
    ])
  }

  return { prompt, error, clearError: () => setError(null) }
}
