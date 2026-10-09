// PROTOTYPE (#86) — throwaway. The Push notifications settings screen. Use ⚙
// to flip the OS permission and offline state.
import { Alert, Linking, ScrollView, Switch, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Text } from '@/components/ui/text'
import { garland } from '@/constants/colors'
import { GarlandButton, GarlandButtonText } from '@/ui/components/GarlandButton'
import { ScreenHeader } from '@/ui/components/ScreenHeader'

import { PrototypeBar } from './PrototypeBar'
import { OfflineStrip, PrePromptSheet } from './parts'
import { PUSH_KINDS, type PushKind, setProto, useProto } from './store'

const COPY: Record<PushKind, { label: string; sub: string }> = {
  invited: { label: 'Invitations', sub: 'Someone adds you to an event' },
  'participant-joined': {
    label: 'New participants',
    sub: 'Someone joins an event you’re in',
  },
  'suggestion-claimed': {
    label: 'Your suggestions claimed',
    sub: 'Someone claims a gift you suggested',
  },
  'claimed-gift-removed': {
    label: 'Claimed gift removed',
    sub: 'A gift you claimed is deleted',
  },
  chat: { label: 'Chat messages', sub: 'New messages in event chats' },
}
const ORDER: PushKind[] = [
  'invited',
  'participant-joined',
  'suggestion-claimed',
  'claimed-gift-removed',
  'chat',
]

export function PushSettingsPrototype() {
  const s = useProto()
  const allowed = s.permission === 'granted'

  const askOs = () =>
    Alert.alert(
      '“Prezentowo” Would Like to Send You Notifications',
      '(Simulated OS prompt.)',
      [
        {
          text: 'Don’t Allow',
          onPress: () => setProto({ permission: 'denied' }),
        },
        { text: 'Allow', onPress: () => setProto({ permission: 'granted' }) },
      ],
    )

  return (
    <SafeAreaView className="flex-1 bg-garland-paper">
      <ScreenHeader title="Push notifications" variant="back" />
      <OfflineStrip />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 140 }}
      >
        <View
          className={`mt-3 rounded-2xl p-4 ${
            allowed ? 'bg-[rgba(47,91,58,0.12)]' : 'bg-garland-paper2'
          }`}
        >
          {s.permission === 'granted' ? (
            <>
              <Text className="text-[15px] font-semibold text-garland-green">
                ● Allowed on this phone
              </Text>
              <Text className="mt-1 text-xs text-garland-ink-60">
                Choose below what’s worth a push.
              </Text>
            </>
          ) : s.permission === 'denied' ? (
            <>
              <Text className="text-[15px] font-semibold text-garland-ink">
                Notifications are off in Settings
              </Text>
              <Text className="mt-1 text-xs text-garland-ink-60">
                Your phone blocks pushes from Prezentowo. Turn them on in
                Settings, then come back.
              </Text>
              <GarlandButton
                variant="outline"
                className="mt-3 self-start"
                onPress={() => Linking.openSettings()}
              >
                <GarlandButtonText>Open Settings</GarlandButtonText>
              </GarlandButton>
            </>
          ) : (
            <>
              <Text className="text-[15px] font-semibold text-garland-ink">
                Pushes aren’t on yet
              </Text>
              <Text className="mt-1 text-xs text-garland-ink-60">
                Your phone will ask you to allow them.
              </Text>
              <GarlandButton className="mt-3 self-start" onPress={askOs}>
                <GarlandButtonText>Turn on</GarlandButtonText>
              </GarlandButton>
            </>
          )}
        </View>

        <Text className="mb-1 mt-7 text-[11px] font-bold uppercase tracking-[1.1px] text-garland-ink-40">
          Send me a push for
        </Text>
        <View
          className="border-t border-garland-ink-08"
          style={{ opacity: allowed && !s.offline ? 1 : 0.4 }}
        >
          {ORDER.map((kind, i) => (
            <View
              key={kind}
              className={`flex-row items-center gap-3 py-3.5 ${
                i === PUSH_KINDS.length - 1
                  ? ''
                  : 'border-b border-garland-ink-08'
              }`}
            >
              <View className="min-w-0 flex-1">
                <Text className="text-[15px] font-semibold text-garland-ink">
                  {COPY[kind].label}
                </Text>
                <Text className="mt-0.5 text-xs text-garland-ink-40">
                  {COPY[kind].sub}
                </Text>
              </View>
              <Switch
                value={s.prefs[kind]}
                disabled={!allowed || s.offline}
                trackColor={{ true: garland.green, false: garland.ink15 }}
                onValueChange={v =>
                  setProto({ prefs: { ...s.prefs, [kind]: v } })
                }
              />
            </View>
          ))}
        </View>

        <Text className="mt-4 text-xs leading-[18px] text-garland-ink-40">
          {s.offline
            ? 'You’re offline — changes need a connection.'
            : 'Turning one off stops the push only; it still shows in your inbox. These follow your account to every phone you sign in on.'}
        </Text>
      </ScrollView>
      <PrePromptSheet />
      <PrototypeBar showVariants={false} />
    </SafeAreaView>
  )
}
