import { BottomSheetModalProvider } from '@gorhom/bottom-sheet'
import { GestureHandlerRootView } from 'react-native-gesture-handler'

import { CreateEventScreen } from '@/ui/screens/CreateEventScreen'

// This route is presented as a native modal, which renders above the app-root
// BottomSheetModalProvider — so the avatar picker needs a provider (and a
// gesture root) scoped to this screen to host the sheet inside it.
export default function CreateEvent() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <BottomSheetModalProvider>
        <CreateEventScreen />
      </BottomSheetModalProvider>
    </GestureHandlerRootView>
  )
}
