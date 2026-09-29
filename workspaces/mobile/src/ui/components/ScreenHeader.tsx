import { router, useNavigation, useRoute } from 'expo-router'
import { DrawerActions } from 'expo-router/react-navigation'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, View } from 'react-native'

import { BackIcon, CloseIcon, HamburgerIcon } from '@/components/ui/icon'
import { Text } from '@/components/ui/text'
import { garland } from '@/constants/colors'

type ScreenHeaderProps = {
  title: string
  // `drawer` screens open the app drawer from a ☰ button (with a back arrow
  // beside it once something is underneath); `modal` screens render above the
  // drawer, so they get a close button instead.
  variant?: 'drawer' | 'modal'
  right?: ReactNode
  // Replaces the modal close button's default `router.back()`.
  onClose?: () => void
}

export function ScreenHeader({
  title,
  variant = 'drawer',
  right,
  onClose = () => router.back(),
}: ScreenHeaderProps) {
  const { t } = useTranslation()
  const navigation = useNavigation()
  const route = useRoute()
  // Only this stack counts: `canGoBack()` also consults parent navigators, so
  // it's true on Home itself. A screen's position in its stack never changes
  // while it's mounted, so reading it once per render is enough.
  const hasScreenBeneath = navigation.getState()?.routes[0]?.key !== route.key

  return (
    <View className="min-h-12 flex-row items-center gap-3 px-[22px] pb-2 pt-3.5">
      {variant === 'drawer' ? (
        <>
          {hasScreenBeneath ? (
            <Pressable
              onPress={() => router.back()}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={t('shell.back')}
            >
              <BackIcon width={22} height={22} color={garland.ink} />
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t('shell.openMenu')}
          >
            <HamburgerIcon width={22} height={22} color={garland.ink} />
          </Pressable>
        </>
      ) : null}
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
