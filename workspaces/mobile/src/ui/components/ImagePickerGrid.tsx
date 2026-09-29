import {
  BACKGROUND_ILLUSTRATION_IDS,
  PRESENT_ILLUSTRATION_IDS,
} from '@prezentowo/types'
import { Image } from 'expo-image'
import * as ImagePicker from 'expo-image-picker'
import { type ReactNode, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, Pressable, ScrollView, View } from 'react-native'

import { type DraftImage, isPhoto } from '@/api/draftImage'
import { photoUri } from '@/api/images'
import { CloseIcon, PhotoIcon } from '@/components/ui/icon'
import { Text } from '@/components/ui/text'
import { garland } from '@/constants/colors'
import { PRESENT_SOURCES } from '@/constants/presents'
import { GarlandButton, GarlandButtonText } from '@/ui/components/GarlandButton'
import { StockBackground } from '@/ui/components/StockBackground'

type PickerError = 'cameraDenied' | 'cameraUnavailable' | 'libraryFailed'

type Art = 'present' | 'background'

const COLUMNS: Record<Art, number> = { present: 4, background: 3 }
// Tile height over width: presents are square, backgrounds a cover strip.
const ASPECT: Record<Art, number> = { present: 1, background: 0.72 }
const ROW_TILE_WIDTH: Record<Art, number> = { present: 72, background: 96 }
const GAP = 8
const RADIUS = 12

// `4c`, `5b` and `6a`: "Upload photo" first, then our stock art, with a ring
// on the current pick (docs/spec.md §5). A photo stays on the device (a
// `local` image) until the wizard saves, which uploads it. Tapping the
// picked stock tile again unpicks it; `removable` (`6a`) adds "Remove".
export function ImagePickerGrid({
  art,
  value,
  onChange,
  preview,
  removable = false,
  layout = 'grid',
}: {
  art: Art
  value: DraftImage | undefined
  onChange: (image: DraftImage | undefined) => void
  // How the current value looks where it will be shown.
  preview: ReactNode
  removable?: boolean
  // `row` scrolls sideways, for a picker that shares its screen.
  layout?: 'grid' | 'row'
}) {
  const { t } = useTranslation()
  const [error, setError] = useState<PickerError | null>(null)
  const [width, setWidth] = useState(0)

  const choose = (result: ImagePicker.ImagePickerResult) => {
    const asset = result.canceled ? undefined : result.assets[0]
    if (asset) onChange({ kind: 'local', uri: asset.uri })
  }

  const takePhoto = async () => {
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
    try {
      // The system picker needs no library permission.
      choose(
        await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'] }),
      )
    } catch {
      setError('libraryFailed')
    }
  }

  const upload = () => {
    setError(null)
    Alert.alert(t('photoPicker.upload'), undefined, [
      { text: t('photoPicker.takePhoto'), onPress: takePhoto },
      { text: t('photoPicker.choosePhoto'), onPress: pickFromLibrary },
      { text: t('photoPicker.cancel'), style: 'cancel' },
    ])
  }

  const pickStock = (id: string) => {
    setError(null)
    const picked = value?.kind === 'illustration' && value.id === id
    onChange(picked ? undefined : { kind: 'illustration', id })
  }

  const columns = COLUMNS[art]
  const tileWidth =
    layout === 'row'
      ? ROW_TILE_WIDTH[art]
      : Math.floor((width - GAP * (columns - 1)) / columns)
  const tileHeight = Math.round(tileWidth * ASPECT[art])
  const stockTile = (id: string, index: number, children: ReactNode) => (
    <Tile
      key={id}
      width={tileWidth}
      height={tileHeight}
      selected={value?.kind === 'illustration' && value.id === id}
      label={t(`photoPicker.${art}Label`, { number: index + 1 })}
      onPress={() => pickStock(id)}
    >
      {children}
    </Tile>
  )

  const tiles = (
    <>
      <Tile
        width={tileWidth}
        height={tileHeight}
        selected={isPhoto(value)}
        label={t('photoPicker.upload')}
        onPress={upload}
      >
        {isPhoto(value) ? (
          <Image
            source={{ uri: photoUri(value, 400) }}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
          />
        ) : (
          <View className="flex-1 items-center justify-center gap-1 border-[1.5px] border-dashed border-garland-ink-15 px-1">
            <PhotoIcon width={20} height={20} color={garland.ink} />
            <Text
              className="text-center text-[11px] font-semibold leading-[13px] text-garland-ink"
              numberOfLines={2}
            >
              {t('photoPicker.upload')}
            </Text>
          </View>
        )}
      </Tile>
      {art === 'present'
        ? PRESENT_ILLUSTRATION_IDS.map((id, i) =>
            stockTile(
              id,
              i,
              <View className="flex-1 items-center justify-center bg-garland-paper2">
                <Image
                  source={PRESENT_SOURCES[id]}
                  style={{ width: '88%', height: '88%' }}
                  contentFit="contain"
                />
              </View>,
            ),
          )
        : BACKGROUND_ILLUSTRATION_IDS.map((id, i) =>
            stockTile(id, i, <StockBackground id={id} />),
          )}
    </>
  )

  return (
    <View>
      <View className="items-center">{preview}</View>
      {layout === 'row' ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="-mx-[22px] mt-4"
          contentContainerStyle={{ paddingHorizontal: 22, gap: GAP }}
        >
          {tiles}
        </ScrollView>
      ) : (
        <View
          className="mt-4 flex-row flex-wrap"
          style={{ gap: GAP }}
          onLayout={e => setWidth(e.nativeEvent.layout.width)}
        >
          {width > 0 ? tiles : null}
        </View>
      )}
      {removable && value ? (
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

// A tile with a ring when it's the current pick.
function Tile({
  width,
  height,
  selected,
  label,
  onPress,
  children,
}: {
  width: number
  height: number
  selected: boolean
  label: string
  onPress: () => void
  children: ReactNode
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      className="active:opacity-70"
      style={{
        width,
        height,
        borderRadius: RADIUS,
        borderWidth: 2.5,
        borderColor: selected ? garland.green : 'transparent',
        padding: 2,
      }}
    >
      <View
        className="flex-1 overflow-hidden"
        style={{ borderRadius: RADIUS - 3 }}
      >
        {children}
      </View>
    </Pressable>
  )
}
