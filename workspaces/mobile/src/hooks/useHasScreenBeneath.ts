import { useNavigation, useRoute } from 'expo-router'

// Whether this screen has another under it in its own stack, so a back
// button makes sense. Only this stack counts: `canGoBack()` also consults
// parent navigators, so it's true on Home itself. A screen's position in its
// stack never changes while it's mounted, so reading it once per render is
// enough.
export function useHasScreenBeneath(): boolean {
  const navigation = useNavigation()
  const route = useRoute()
  return navigation.getState()?.routes[0]?.key !== route.key
}
