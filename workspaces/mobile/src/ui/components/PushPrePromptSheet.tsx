import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetView,
} from '@gorhom/bottom-sheet'
import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'
import { View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { BellIcon } from '@/components/ui/icon'
import { Text } from '@/components/ui/text'
import { garland } from '@/constants/colors'
import { pushPermission, pushPrePrompt } from '@/push'
import { GarlandButton, GarlandButtonText } from '@/ui/components/GarlandButton'

// Lets the create or invite modal finish closing first, so the sheet isn't
// presented underneath it.
const PRESENT_DELAY_MS = 500

// Asks before the OS does, after the user's first event (docs/spec.md §10.5).
// Turn on shows the OS prompt once the sheet is gone; Not now just closes.
export function PushPrePromptSheet() {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const ref = useRef<BottomSheetModal>(null)
  const turningOn = useRef(false)
  const open = useSyncExternalStore(
    pushPrePrompt.subscribe,
    pushPrePrompt.isOpen,
  )

  useEffect(() => {
    if (!open) return
    const timer = setTimeout(() => ref.current?.present(), PRESENT_DELAY_MS)
    return () => clearTimeout(timer)
  }, [open])

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={0.4}
      />
    ),
    [],
  )

  const onDismiss = () => {
    pushPrePrompt.close()
    if (!turningOn.current) return
    turningOn.current = false
    void pushPermission.request()
  }

  return (
    <BottomSheetModal
      ref={ref}
      enableDynamicSizing
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: garland.paper }}
      handleIndicatorStyle={{ backgroundColor: garland.ink40 }}
      onDismiss={onDismiss}
    >
      <BottomSheetView
        style={{ paddingHorizontal: 22, paddingBottom: insets.bottom + 16 }}
      >
        <View className="mt-2 size-14 items-center justify-center self-center rounded-full bg-[rgba(47,91,58,0.12)]">
          <BellIcon width={26} height={26} color={garland.green} />
        </View>
        <Text className="mt-4 text-center font-garland-display text-[28px] leading-[32px] text-garland-ink">
          {t('pushSettings.prePrompt.title')}
        </Text>
        <Text className="mt-2.5 text-center text-[15px] leading-[22px] text-garland-ink-60">
          {t('pushSettings.prePrompt.body')}
        </Text>
        <Text className="mt-2 text-center text-xs text-garland-ink-40">
          {t('pushSettings.prePrompt.hint', {
            path: `${t('shell.profile')} → ${t('profile.pushNotifications')}`,
          })}
        </Text>
        <GarlandButton
          className="mt-6"
          onPress={() => {
            turningOn.current = true
            ref.current?.dismiss()
          }}
        >
          <GarlandButtonText>
            {t('pushSettings.prePrompt.turnOn')}
          </GarlandButtonText>
        </GarlandButton>
        <GarlandButton
          variant="link"
          className="mt-2 self-center"
          onPress={() => ref.current?.dismiss()}
        >
          <GarlandButtonText>
            {t('pushSettings.prePrompt.notNow')}
          </GarlandButtonText>
        </GarlandButton>
      </BottomSheetView>
    </BottomSheetModal>
  )
}
