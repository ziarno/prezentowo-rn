import {
  type ApnsEnvironment,
  isSixteenPlus,
  todayUtc,
} from '@prezentowo/types'
import {
  ApplicationReleaseType,
  getIosApplicationReleaseTypeAsync,
  getIosPushNotificationServiceEnvironmentAsync,
} from 'expo-application'
import Constants from 'expo-constants'
import * as Notifications from 'expo-notifications'
import * as SecureStore from 'expo-secure-store'
import { Platform } from 'react-native'

import { getCurrentUser } from '@/api/users'
import i18n from '@/localization/i18n'
import { call } from '@/sync'

import { type PushPermission, createPushPermission } from './permission'
import { createPushPrePrompt } from './prePrompt'
import { createPushDevice } from './registration'

// A sign-out waits for its unregister; past this the token is kept for later.
const UNREGISTER_TIMEOUT_MS = 5_000

// The build's APNs environment, so the server registers its token with the
// matching Stream provider. A build without a provisioning profile is a
// simulator (sandbox tokens) or an App Store one.
async function apnsEnvironment(): Promise<ApnsEnvironment> {
  const environment = await getIosPushNotificationServiceEnvironmentAsync()
  if (environment) return environment
  const release = await getIosApplicationReleaseTypeAsync()
  return release === ApplicationReleaseType.SIMULATOR
    ? 'development'
    : 'production'
}

// Android 13+ shows no prompt, and hands out no token, until the app has a
// channel. Expo pushes without a channelId land in `default`.
const androidChannel =
  Platform.OS === 'android'
    ? Notifications.setNotificationChannelAsync('default', {
        name: 'Prezentowo',
        importance: Notifications.AndroidImportance.HIGH,
      }).catch(() => null)
    : Promise.resolve(null)

export const pushDevice = createPushDevice({
  permissionGranted: async () =>
    (await Notifications.getPermissionsAsync()).granted,
  device: async () => {
    await androidChannel
    const projectId: string | undefined =
      Constants.expoConfig?.extra?.eas?.projectId
    const [expo, native] = await Promise.all([
      Notifications.getExpoPushTokenAsync({ projectId }),
      Notifications.getDevicePushTokenAsync(),
    ])
    const deviceToken = String(native.data)
    return Platform.OS === 'ios'
      ? {
          expoToken: expo.data,
          deviceToken,
          platform: 'ios',
          apnsEnvironment: await apnsEnvironment(),
        }
      : { expoToken: expo.data, deviceToken, platform: 'android' }
  },
  locale: () => (i18n.language === 'pl' ? 'pl' : 'en'),
  register: args => call('push.register', args),
  unregister: expoToken =>
    call(
      'push.unregister',
      { expoToken },
      { timeoutMs: UNREGISTER_TIMEOUT_MS },
    ),
  store: {
    get: SecureStore.getItemAsync,
    set: SecureStore.setItemAsync,
    remove: SecureStore.deleteItemAsync,
  },
})

const toPushPermission = (
  status: Notifications.NotificationPermissionsStatus,
): PushPermission =>
  status.granted ? 'granted' : status.canAskAgain ? 'undetermined' : 'denied'

export const pushPermission = createPushPermission({
  read: async () => toPushPermission(await Notifications.getPermissionsAsync()),
  request: async () => {
    await androidChannel
    return toPushPermission(await Notifications.requestPermissionsAsync())
  },
  onGranted: () => pushDevice.register(),
})

export const pushPrePrompt = createPushPrePrompt({
  // Judged on the day it is asked, never remembered.
  sixteenPlus: () => isSixteenPlus(getCurrentUser(), todayUtc()),
  // An unreadable permission counts as answered: the sheet stays shut.
  permission: async () => {
    await pushPermission.refresh()
    return pushPermission.get() ?? 'denied'
  },
  store: { get: SecureStore.getItemAsync, set: SecureStore.setItemAsync },
})

// A new native token, or the app's language changed: the server's copy is
// out of date.
Notifications.addPushTokenListener(() => pushDevice.register())
i18n.on('languageChanged', () => pushDevice.register())
