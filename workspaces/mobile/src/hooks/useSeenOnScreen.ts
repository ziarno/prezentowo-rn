import { type NativeStackNavigationProp, useNavigation } from 'expo-router'
import { useEffect, useState } from 'react'
import { type View, useWindowDimensions } from 'react-native'
import {
  type SharedValue,
  measure,
  useAnimatedReaction,
  useAnimatedRef,
  useSharedValue,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'

// Whether the viewer has seen a view yet: all of it inside the window, once
// the screen has finished sliding in. Checked on the UI thread against the
// view's measured frame whenever `scrollY` moves or the view lays out, so it
// holds whether it's on screen from the start or scrolled to later. Put the
// ref and `onLayout` on an untransformed wrapper: transforms skew the
// measured frame.
export function useSeenOnScreen(scrollY: SharedValue<number>) {
  const ref = useAnimatedRef<View>()
  const { height } = useWindowDimensions()
  const navigation =
    useNavigation<
      NativeStackNavigationProp<Record<string, object | undefined>>
    >()
  const [seen, setSeen] = useState(false)
  const settled = useSharedValue(false)
  const layouts = useSharedValue(0)
  const done = useSharedValue(false)

  useEffect(
    () =>
      navigation.addListener('transitionEnd', e => {
        if (!e.data.closing) settled.set(true)
      }),
    [navigation, settled],
  )

  useAnimatedReaction(
    () => {
      scrollY.get()
      if (done.get() || !settled.get() || layouts.get() === 0) return false
      const frame = measure(ref)
      return (
        !!frame &&
        frame.height > 0 &&
        frame.pageY >= 0 &&
        frame.pageY + frame.height <= height
      )
    },
    on => {
      if (!on) return
      done.set(true)
      scheduleOnRN(setSeen, true)
    },
  )

  const onLayout = () => layouts.set(layouts.get() + 1)
  return [ref, onLayout, seen] as const
}
