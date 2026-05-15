import { OverlayProvider } from '@gluestack-ui/core/overlay/creator'
import { ToastProvider } from '@gluestack-ui/core/toast/creator'
import { useColorScheme } from 'nativewind'
import React, { useEffect } from 'react'
import { View, ViewProps } from 'react-native'

import { config } from './config'

export type ModeType = 'light' | 'dark' | 'system'

export function GluestackUIProvider({
  mode = 'light',
  ...props
}: {
  mode?: ModeType
  children?: React.ReactNode
  style?: ViewProps['style']
}) {
  const { colorScheme, setColorScheme } = useColorScheme()

  useEffect(() => {
    setColorScheme(mode)
  }, [mode, setColorScheme])

  return (
    <View
      className="h-full w-full flex-1"
      style={[config[colorScheme!], props.style]}
    >
      <OverlayProvider>
        <ToastProvider>{props.children}</ToastProvider>
      </OverlayProvider>
    </View>
  )
}
