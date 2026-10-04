import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetView,
} from '@gorhom/bottom-sheet'
import { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { CloseIcon } from '@/components/ui/icon'
import { Text } from '@/components/ui/text'
import {
  type AvatarGender,
  type AvatarKey,
  avatar,
  avatarGender,
  avatarKeysForGender,
} from '@/constants/avatars'
import { garland } from '@/constants/colors'
import { AvatarTile } from '@/ui/components/AvatarTile'
import { GarlandButton, GarlandButtonText } from '@/ui/components/GarlandButton'
import { GenderToggle } from '@/ui/components/GenderToggle'
import { PhotoUploadTile } from '@/ui/components/PhotoUploadTile'

export type AvatarPickerModalHandle = { present: () => void }

type Props = {
  value: AvatarKey | null
  onConfirm: (key: AvatarKey) => void
  // Set: the grid starts with an upload tile, which closes the sheet and
  // calls this to take or pick a photo instead.
  onPhoto?: () => void
}

export const AvatarPickerModal = forwardRef<AvatarPickerModalHandle, Props>(
  function AvatarPickerModal({ value, onConfirm, onPhoto }, ref) {
    const { t } = useTranslation()
    const insets = useSafeAreaInsets()
    const sheetRef = useRef<BottomSheetModal>(null)

    // Opens on the current `value`, which may have changed since it last
    // closed (e.g. a photo replaced it).
    useImperativeHandle(ref, () => ({
      present: () => {
        setDraft(value)
        setGender(value ? avatarGender(value) : 'female')
        sheetRef.current?.present()
      },
    }))

    const [draft, setDraft] = useState<AvatarKey | null>(value)
    const [gender, setGender] = useState<AvatarGender>(
      value ? avatarGender(value) : 'female',
    )

    const handleChange = (index: number) => {
      const CLOSED_INDEX = -1
      if (index === CLOSED_INDEX) {
        setDraft(value)
        setGender(value ? avatarGender(value) : 'female')
      }
    }

    const dismiss = () => sheetRef.current?.dismiss()

    const renderBackdrop = (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={0.4}
      />
    )

    return (
      <BottomSheetModal
        ref={sheetRef}
        onChange={handleChange}
        enableDynamicSizing
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: garland.paper }}
        handleIndicatorStyle={{ backgroundColor: garland.ink40 }}
      >
        <BottomSheetView
          style={{ paddingHorizontal: 22, paddingBottom: insets.bottom + 16 }}
        >
          <View className="flex-row items-center justify-between pb-3 pt-1">
            <Text className="text-[11px] font-bold uppercase tracking-[1.1px] text-garland-ink-40">
              {t('avatarPicker.title')}
            </Text>
            <Pressable onPress={dismiss} hitSlop={12}>
              <CloseIcon width={20} height={20} color={garland.ink40} />
            </Pressable>
          </View>

          <GenderToggle gender={gender} onChange={setGender} />

          <View className="-mx-1.5 mt-4 flex-row flex-wrap">
            {onPhoto ? (
              <View style={{ width: '20%' }} className="p-1.5">
                <PhotoUploadTile
                  onPress={() => {
                    dismiss()
                    onPhoto()
                  }}
                />
              </View>
            ) : null}
            {avatarKeysForGender(gender).map(key => (
              <View key={key} style={{ width: '20%' }} className="p-1.5">
                <AvatarTile
                  source={avatar(key)}
                  selected={draft === key}
                  onPress={() => setDraft(key)}
                />
              </View>
            ))}
          </View>

          <View className="mt-5 flex-row gap-3">
            <View className="flex-1">
              <GarlandButton variant="outline" onPress={dismiss}>
                <GarlandButtonText>
                  {t('avatarPicker.cancel')}
                </GarlandButtonText>
              </GarlandButton>
            </View>
            <View className="flex-1">
              <GarlandButton
                onPress={() => {
                  if (draft) {
                    onConfirm(draft)
                    dismiss()
                  }
                }}
                disabled={!draft}
              >
                <GarlandButtonText>
                  {t('avatarPicker.accept')}
                </GarlandButtonText>
              </GarlandButton>
            </View>
          </View>
        </BottomSheetView>
      </BottomSheetModal>
    )
  },
)
