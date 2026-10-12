import { PUSH_KINDS, type PushKind } from '@prezentowo/types'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, Linking, ScrollView, Switch, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import {
  type PushToggles,
  pushPreferenceOn,
  unconfirmedToggles,
} from '@/api/pushPreferences'
import { setPushPreference } from '@/api/users'
import { Text } from '@/components/ui/text'
import { garland } from '@/constants/colors'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useOffline } from '@/hooks/useOffline'
import { usePushPermission } from '@/hooks/usePushPermission'
import { errorMessage } from '@/localization/errorMessage'
import { pushPermission } from '@/push'
import { GarlandButton, GarlandButtonText } from '@/ui/components/GarlandButton'
import { ScreenHeader } from '@/ui/components/ScreenHeader'

// Push settings (docs/spec.md §10.2): the OS permission's status card, then a
// switch per kind, saved to the account.
export function PushNotificationsScreen() {
  const { t } = useTranslation()
  const offline = useOffline()
  const permission = usePushPermission()
  const user = useCurrentUser()
  // A flipped switch shows its new value until the user document does.
  const [toggled, setToggled] = useState<PushToggles>({})
  const preferences = user?.pushPreferences

  useEffect(() => {
    setToggled(current => unconfirmedToggles(current, preferences))
  }, [preferences])

  const allowed = permission === 'granted'
  const disabled = !allowed || offline

  const toggle = async (kind: PushKind, enabled: boolean) => {
    setToggled(current => ({ ...current, [kind]: enabled }))
    try {
      await setPushPreference({ kind, enabled })
    } catch (err) {
      // Back to the saved value, unless it was flipped again meanwhile.
      setToggled(({ [kind]: shown, ...rest }) =>
        shown === enabled ? rest : { ...rest, [kind]: shown },
      )
      Alert.alert(
        t('pushSettings.saveFailed'),
        errorMessage(err, t('common.somethingWentWrong')),
      )
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-garland-paper">
      <ScreenHeader title={t('pushSettings.title')} variant="back" />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <StatusCard />

        <Text className="mb-1 mt-7 text-[11px] font-bold uppercase tracking-[1.1px] text-garland-ink-40">
          {t('pushSettings.sendMeFor')}
        </Text>
        <View
          className={`border-t border-garland-ink-08 ${disabled ? 'opacity-40' : ''}`}
        >
          {PUSH_KINDS.map((kind, index) => (
            <View
              key={kind}
              className={`flex-row items-center gap-3 py-3.5 ${
                index === PUSH_KINDS.length - 1
                  ? ''
                  : 'border-b border-garland-ink-08'
              }`}
            >
              <View className="min-w-0 flex-1">
                <Text className="text-[15px] font-semibold text-garland-ink">
                  {t(`pushSettings.kinds.${kind}.label`)}
                </Text>
                <Text className="mt-0.5 text-xs text-garland-ink-40">
                  {t(`pushSettings.kinds.${kind}.note`)}
                </Text>
              </View>
              <Switch
                value={toggled[kind] ?? pushPreferenceOn(preferences, kind)}
                disabled={disabled}
                trackColor={{ true: garland.green, false: garland.ink15 }}
                onValueChange={enabled => void toggle(kind, enabled)}
                accessibilityLabel={t(`pushSettings.kinds.${kind}.label`)}
              />
            </View>
          ))}
        </View>

        <Text className="mt-4 text-xs leading-[18px] text-garland-ink-40">
          {offline
            ? t('pushSettings.footnoteOffline')
            : t('pushSettings.footnote')}
        </Text>
      </ScrollView>
    </SafeAreaView>
  )
}

// What the OS says: not asked yet (Turn on → the OS prompt, no pre-prompt
// here), allowed, or blocked (Open Settings).
function StatusCard() {
  const { t } = useTranslation()
  const permission = usePushPermission()

  if (permission === 'granted') {
    return (
      <View className="mt-3 rounded-2xl bg-[rgba(47,91,58,0.12)] p-4">
        <Text className="text-[15px] font-semibold text-garland-green">
          ● {t('pushSettings.granted')}
        </Text>
        <Text className="mt-1 text-xs text-garland-ink-60">
          {t('pushSettings.grantedNote')}
        </Text>
      </View>
    )
  }

  const denied = permission === 'denied'
  return (
    <View className="mt-3 rounded-2xl bg-garland-paper2 p-4">
      <Text className="text-[15px] font-semibold text-garland-ink">
        {denied ? t('pushSettings.denied') : t('pushSettings.notAsked')}
      </Text>
      <Text className="mt-1 text-xs text-garland-ink-60">
        {denied ? t('pushSettings.deniedNote') : t('pushSettings.notAskedNote')}
      </Text>
      {/* Hidden until the first read, so it can't prompt on a stale guess. */}
      {permission === null ? null : (
        <GarlandButton
          variant={denied ? 'outline' : 'solid'}
          className="mt-3 self-start"
          onPress={() =>
            denied ? void Linking.openSettings() : void pushPermission.request()
          }
        >
          <GarlandButtonText>
            {denied ? t('pushSettings.openSettings') : t('pushSettings.turnOn')}
          </GarlandButtonText>
        </GarlandButton>
      )}
    </View>
  )
}
