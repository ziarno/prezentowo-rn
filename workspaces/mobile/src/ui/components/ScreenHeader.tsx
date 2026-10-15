import { router, useNavigation } from 'expo-router'
import { DrawerActions } from 'expo-router/react-navigation'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, View } from 'react-native'

import { BackIcon, CloseIcon, HamburgerIcon } from '@/components/ui/icon'
import { Text } from '@/components/ui/text'
import { garland } from '@/constants/colors'

type ScreenHeaderProps = {
  title: string
  // `drawer` is for an event's sections: a ☰ button opens the event's drawer,
  // with no back arrow, since sections leave no history (the drawer's "Back
  // to home" is the way out). `back` screens, pushed over a section or Home,
  // get the back arrow alone; `modal` screens get a close button instead.
  // `left` replaces the leading buttons of a non-modal screen.
  variant?: 'drawer' | 'back' | 'modal'
  left?: ReactNode
  // Shown just before the title, e.g. a person's avatar.
  leading?: ReactNode
  right?: ReactNode
  // Replaces the modal close button's default `router.back()`.
  onClose?: () => void
}

export function ScreenHeader({
  title,
  variant = 'drawer',
  left,
  leading,
  right,
  onClose = () => router.back(),
}: ScreenHeaderProps) {
  const { t } = useTranslation()
  const navigation = useNavigation()

  return (
    <View className="min-h-12 flex-row items-center gap-3 px-[22px] pb-2 pt-3.5">
      {variant === 'modal' ? null : left ? (
        left
      ) : (
        <>
          {variant === 'back' ? (
            <Pressable
              onPress={() => router.back()}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={t('shell.back')}
            >
              <BackIcon width={22} height={22} color={garland.ink} />
            </Pressable>
          ) : null}
          {variant === 'drawer' ? (
            <Pressable
              onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={t('shell.openMenu')}
            >
              <HamburgerIcon width={22} height={22} color={garland.ink} />
            </Pressable>
          ) : null}
        </>
      )}
      {leading}
      <Text
        className="flex-1 font-garland-display text-lg text-garland-ink"
        numberOfLines={1}
        accessibilityRole="header"
      >
        {title}
      </Text>
      {right}
      {variant === 'modal' ? (
        <Pressable
          onPress={onClose}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={t('shell.close')}
        >
          <CloseIcon width={22} height={22} color={garland.ink} />
        </Pressable>
      ) : null}
    </View>
  )
}
