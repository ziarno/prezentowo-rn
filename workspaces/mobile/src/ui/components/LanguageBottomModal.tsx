import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetView,
  useBottomSheetModal,
} from '@gorhom/bottom-sheet'
import { Trans, useLingui } from '@lingui/react/macro'
import { forwardRef, useCallback } from 'react'
import { Pressable, View } from 'react-native'

import { CheckIcon } from '@/components/ui/icon'
import { Text } from '@/components/ui/text'
import { garland } from '@/constants/colors'
import {
  LOCALES,
  type SupportedLocale,
  setLocale,
} from '@/localization/provider'

export const LanguageBottomModal = forwardRef<BottomSheetModal>(
  function LanguageBottomModal(_, ref) {
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

    return (
      <BottomSheetModal
        ref={ref}
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: garland.paper }}
        handleIndicatorStyle={{ backgroundColor: garland.ink40 }}
      >
        <BottomSheetView style={{ paddingHorizontal: 22, paddingBottom: 32 }}>
          <Text className="mb-2 mt-1 text-[11px] font-bold uppercase tracking-[1.1px] text-garland-ink-40">
            <Trans>Language</Trans>
          </Text>
          <LanguageList />
        </BottomSheetView>
      </BottomSheetModal>
    )
  },
)

function LanguageList() {
  const { i18n } = useLingui()
  const { dismiss } = useBottomSheetModal()
  const current = i18n.locale as SupportedLocale

  return (
    <View className="border-t border-garland-ink-08">
      {LOCALES.map((locale, index) => {
        const isLast = index === LOCALES.length - 1
        const isActive = current === locale.code
        return (
          <Pressable
            key={locale.code}
            onPress={() => {
              setLocale(locale.code)
              dismiss()
            }}
            className={`flex-row items-center justify-between py-3.5 ${
              isLast ? '' : 'border-b border-garland-ink-08'
            }`}
          >
            <Text className="text-[15px] font-semibold text-garland-ink">
              {locale.label}
            </Text>
            {isActive ? (
              <CheckIcon width={18} height={18} color={garland.ink} />
            ) : null}
          </Pressable>
        )
      })}
    </View>
  )
}
