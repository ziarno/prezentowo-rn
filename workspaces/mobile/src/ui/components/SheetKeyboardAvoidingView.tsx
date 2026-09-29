import { type ReactNode, useEffect, useState } from 'react'
import { Keyboard, Platform, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

// Keeps a sheet's content, and the buttons at its bottom, above the iOS
// keyboard. RN's KeyboardAvoidingView measures its own frame relative to the
// sheet but the keyboard relative to the screen, so inside a sheet it lifts
// too little. A sheet always ends at the bottom of the screen, so padding by
// the keyboard's height (less the safe area it already covers) is exact.
// Android resizes the window itself.
export function SheetKeyboardAvoidingView({
  children,
}: {
  children: ReactNode
}) {
  const insets = useSafeAreaInsets()
  const [keyboardHeight, setKeyboardHeight] = useState(0)

  useEffect(() => {
    if (Platform.OS !== 'ios') return
    const show = Keyboard.addListener('keyboardWillShow', e =>
      setKeyboardHeight(e.endCoordinates.height),
    )
    const hide = Keyboard.addListener('keyboardWillHide', () =>
      setKeyboardHeight(0),
    )
    return () => {
      show.remove()
      hide.remove()
    }
  }, [])

  return (
    <View
      className="flex-1"
      style={{ paddingBottom: Math.max(0, keyboardHeight - insets.bottom) }}
    >
      {children}
    </View>
  )
}
