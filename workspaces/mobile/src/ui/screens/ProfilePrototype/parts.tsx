// PROTOTYPE (#86) — throwaway. Pieces shared by the Profile variants. All
// actions are stubs: nothing is written to the server or signs you out.
import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetView,
} from '@gorhom/bottom-sheet'
import * as Application from 'expo-application'
import { type Href, router } from 'expo-router'
import type { ComponentType, ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { uploadImageUrl } from '@/api/images'
import fakePhoto from '@/assets/images/presents/p10-600px.png'
import {
  BellIcon,
  CheckIcon,
  CloseIcon,
  PencilIcon,
} from '@/components/ui/icon'
import { Text } from '@/components/ui/text'
import { type AvatarKey, avatar } from '@/constants/avatars'
import { garland } from '@/constants/colors'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useLanguageModal } from '@/localization/LanguageModalProvider'
import { LOCALES } from '@/localization/provider'
import { GarlandButton, GarlandButtonText } from '@/ui/components/GarlandButton'

import { pushSummary, setProto, useProto } from './store'

export type IconComponent = ComponentType<{
  width?: number
  height?: number
  color?: string
}>

export const LANDING = 'https://prezentowo.jarno.pl'
export const openPrivacy = () => Linking.openURL(`${LANDING}/privacy`)
export const openTerms = () => Linking.openURL(`${LANDING}/terms`)
export const openPushSettings = () =>
  router.push('/push-settings-prototype' as Href)

// Fake until "Profile stats: definitions and contract" lands.
export const STATS = [
  { value: '4', label: 'Events' },
  { value: '17', label: 'Wished' },
  { value: '9', label: 'Claimed' },
]

export function appVersion() {
  return `${Application.nativeApplicationVersion ?? '?'} (${
    Application.nativeBuildVersion ?? '?'
  })`
}

export function useProfileData() {
  const { i18n } = useTranslation()
  const { open: openLanguage } = useLanguageModal()
  const user = useCurrentUser()
  const s = useProto()
  const [name, setName] = useState<string | null>(null)
  const photo = user?.profile?.photo
  const key = (user?.profile?.avatar as AvatarKey | undefined) ?? 'm1'
  return {
    name: name ?? user?.profile?.name ?? 'Friend',
    setName,
    email: user?.emails?.[0]?.address ?? 'you@example.com',
    joined: 'Joined Aug ’26',
    // No real photo saved? A bundled picture stands in for one.
    avatarSource: s.hasPhoto
      ? photo
        ? { uri: uploadImageUrl(photo, 400) }
        : fakePhoto
      : avatar(key),
    avatarKey: key,
    language: LOCALES.find(l => l.code === i18n.language)?.label ?? 'English',
    openLanguage,
    pushLabel: pushSummary(s),
    offline: s.offline,
  }
}

export function confirmSignOut(queued: number) {
  Alert.alert(
    'Sign out?',
    queued > 0
      ? `${queued} change${queued === 1 ? '' : 's'} made offline ${
          queued === 1 ? "hasn't" : "haven't"
        } reached the server and will be lost.`
      : 'You can sign back in any time with a link sent to your email.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: queued > 0 ? `Sign out and lose ${queued}` : 'Sign out',
        style: 'destructive',
        onPress: () => Alert.alert('Prototype', 'Would sign out here.'),
      },
    ],
  )
}

// Under Sign out: what signing out would lose, before you tap it.
export function QueuedNote({ center }: { center?: boolean }) {
  const { queued } = useProto()
  if (queued === 0) return null
  return (
    <Text
      className={`mt-1.5 text-xs text-garland-ink-40 ${center ? 'text-center' : ''}`}
    >
      {queued} offline change{queued === 1 ? '' : 's'} not synced yet
    </Text>
  )
}

export function OfflineStrip() {
  const { offline } = useProto()
  if (!offline) return null
  return (
    <View className="bg-[rgba(199,151,61,0.15)] px-[22px] py-2">
      <Text className="text-xs font-semibold text-[#8a6420]">
        You’re offline (simulated)
      </Text>
    </View>
  )
}

export function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View className="flex-1">
      <Text className="text-[32px] font-light leading-[34px] text-garland-ink">
        {value}
      </Text>
      <Text className="mt-1 text-[11px] font-bold uppercase tracking-[1px] text-garland-ink-40">
        {label}
      </Text>
    </View>
  )
}

export function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <Text className="mb-2.5 mt-7 text-[11px] font-bold uppercase tracking-[1.1px] text-garland-ink-40">
      {children}
    </Text>
  )
}

export function SettingsRow({
  Icon,
  label,
  sublabel,
  onPress,
  last,
  disabled,
  tone = 'ink',
  chevron = true,
}: {
  Icon?: IconComponent
  label: string
  sublabel?: string
  onPress?: () => void
  last?: boolean
  disabled?: boolean
  tone?: 'ink' | 'berry'
  chevron?: boolean
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        opacity: disabled ? 0.4 : pressed ? 0.6 : 1,
      })}
      className={`flex-row items-center gap-3 py-3.5 ${
        last ? '' : 'border-b border-garland-ink-08'
      }`}
    >
      {Icon ? (
        <View className="size-9 items-center justify-center">
          <Icon width={20} height={20} color={garland.ink} />
        </View>
      ) : null}
      <View className="min-w-0 flex-1">
        <Text
          className={`text-[15px] font-semibold ${
            tone === 'berry' ? 'text-garland-berry' : 'text-garland-ink'
          }`}
        >
          {label}
        </Text>
        {sublabel ? (
          <Text className="mt-0.5 text-xs text-garland-ink-40">{sublabel}</Text>
        ) : null}
      </View>
      {chevron ? <Text className="text-garland-ink-40">›</Text> : null}
    </Pressable>
  )
}

// The name, swapped for a field in place while editing. Name only.
export function EditableName({
  name,
  onSave,
  editing,
  setEditing,
  disabled,
  className = 'font-garland-display text-[36px] leading-[40px] text-garland-ink',
  showPencil,
  center,
}: {
  name: string
  onSave: (name: string) => void
  editing: boolean
  setEditing: (v: boolean) => void
  disabled?: boolean
  className?: string
  showPencil?: boolean
  center?: boolean
}) {
  const [draft, setDraft] = useState(name)
  const startEditing = () => {
    setDraft(name)
    setEditing(true)
  }

  if (editing) {
    const trimmed = draft.trim()
    return (
      <View
        className={`flex-row items-center gap-2 ${center ? 'self-stretch' : ''}`}
      >
        <TextInput
          value={draft}
          onChangeText={setDraft}
          autoFocus
          maxLength={40}
          returnKeyType="done"
          onSubmitEditing={() => {
            if (trimmed) onSave(trimmed)
            setEditing(false)
          }}
          className={`flex-1 border-b-2 border-garland-ink pb-1 ${className}`}
          style={center ? { textAlign: 'center' } : undefined}
        />
        <Pressable
          onPress={() => {
            setDraft(name)
            setEditing(false)
          }}
          hitSlop={8}
          className="size-9 items-center justify-center rounded-full bg-garland-ink-08"
        >
          <CloseIcon width={16} height={16} color={garland.ink} />
        </Pressable>
        <Pressable
          disabled={!trimmed}
          onPress={() => {
            onSave(trimmed)
            setEditing(false)
          }}
          hitSlop={8}
          className="size-9 items-center justify-center rounded-full bg-garland-ink"
          style={{ opacity: trimmed ? 1 : 0.4 }}
        >
          <CheckIcon width={16} height={16} color={garland.paper} />
        </Pressable>
      </View>
    )
  }
  return (
    <Pressable
      onPress={startEditing}
      disabled={disabled}
      className={`flex-row items-center gap-2 ${center ? 'self-center' : ''}`}
      style={{ opacity: disabled ? 0.4 : 1 }}
    >
      <Text className={className}>{name}.</Text>
      {showPencil ? (
        <PencilIcon width={18} height={18} color={garland.ink40} />
      ) : null}
    </Pressable>
  )
}

// Typed-email confirm, online-only (Account deletion: what happens to your
// data).
export function DeleteAccountModal({
  visible,
  onClose,
  email,
}: {
  visible: boolean
  onClose: () => void
  email: string
}) {
  const { offline } = useProto()
  const [typed, setTyped] = useState('')
  const matches = typed.trim().toLowerCase() === email.toLowerCase()
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
      onDismiss={() => setTyped('')}
    >
      <ScrollView
        className="flex-1 bg-garland-paper"
        contentContainerStyle={{ padding: 22, paddingBottom: 60 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="flex-row justify-end">
          <Pressable onPress={onClose} hitSlop={12}>
            <CloseIcon width={22} height={22} color={garland.ink} />
          </Pressable>
        </View>
        <Text className="mt-2 font-garland-display text-[30px] leading-[34px] text-garland-ink">
          Delete your account?
        </Text>
        <Text className="mt-3 text-[15px] leading-[22px] text-garland-ink-60">
          This happens straight away and can’t be undone.
        </Text>
        <View className="mt-5 gap-3">
          {[
            'Events you created pass to their earliest remaining member, or are deleted if no one is left.',
            'Your name stays on other people’s lists so their plans still make sense, but nobody can claim for you.',
            'Gifts you claimed are released.',
            'Gifts you added and your chat messages stay, shown as “Deleted user”.',
          ].map(line => (
            <View key={line} className="flex-row gap-2.5">
              <Text className="text-garland-ink-40">•</Text>
              <Text className="flex-1 text-sm leading-5 text-garland-ink">
                {line}
              </Text>
            </View>
          ))}
        </View>
        <Text className="mb-2 mt-7 text-[11px] font-bold uppercase tracking-[1.1px] text-garland-ink-40">
          Type {email} to confirm
        </Text>
        <TextInput
          value={typed}
          onChangeText={setTyped}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          placeholder={email}
          placeholderTextColor={garland.ink15}
          className="rounded-xl border-[1.5px] border-garland-ink-15 px-4 py-3.5 text-base text-garland-ink"
        />
        {offline ? (
          <Text className="mt-3 text-xs text-garland-berry">
            You’re offline. Deleting needs a connection.
          </Text>
        ) : null}
        <GarlandButton
          className="mt-5 bg-garland-berry data-[active=true]:bg-garland-berry"
          disabled={!matches || offline}
          onPress={() =>
            Alert.alert('Prototype', 'Would call users.deleteAccount here.')
          }
        >
          <GarlandButtonText>Delete account</GarlandButtonText>
        </GarlandButton>
      </ScrollView>
    </Modal>
  )
}

const renderBackdrop = (props: BottomSheetBackdropProps) => (
  <BottomSheetBackdrop
    {...props}
    appearsOnIndex={0}
    disappearsOnIndex={-1}
    opacity={0.4}
  />
)

// Our own ask before the OS prompt; the OS prompt follows Turn on only.
export function PrePromptSheet() {
  const { prePromptOpen } = useProto()
  const insets = useSafeAreaInsets()
  const ref = useRef<BottomSheetModal>(null)

  useEffect(() => {
    if (prePromptOpen) ref.current?.present()
  }, [prePromptOpen])

  const fakeOsPrompt = () =>
    Alert.alert(
      '“Prezentowo” Would Like to Send You Notifications',
      '(Simulated OS prompt.) Notifications may include alerts, sounds, and icon badges.',
      [
        {
          text: 'Don’t Allow',
          onPress: () => setProto({ permission: 'denied' }),
        },
        { text: 'Allow', onPress: () => setProto({ permission: 'granted' }) },
      ],
    )

  return (
    <BottomSheetModal
      ref={ref}
      enableDynamicSizing
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: garland.paper }}
      handleIndicatorStyle={{ backgroundColor: garland.ink40 }}
      onDismiss={() => setProto({ prePromptOpen: false })}
    >
      <BottomSheetView
        style={{ paddingHorizontal: 22, paddingBottom: insets.bottom + 16 }}
      >
        <View className="mt-2 size-14 items-center justify-center self-center rounded-full bg-[rgba(47,91,58,0.12)]">
          <BellIcon width={26} height={26} color={garland.green} />
        </View>
        <Text className="mt-4 text-center font-garland-display text-[28px] leading-[32px] text-garland-ink">
          Hear about it first
        </Text>
        <Text className="mt-2.5 text-center text-[15px] leading-[22px] text-garland-ink-60">
          Get a push when you’re invited, when someone joins your event, claims
          a gift you suggested, or writes in chat.
        </Text>
        <Text className="mt-2 text-center text-xs text-garland-ink-40">
          You can choose which ones in Profile → Push notifications.
        </Text>
        <GarlandButton
          className="mt-6"
          onPress={() => {
            ref.current?.dismiss()
            setTimeout(fakeOsPrompt, 350)
          }}
        >
          <GarlandButtonText>Turn on</GarlandButtonText>
        </GarlandButton>
        <GarlandButton
          variant="link"
          className="mt-2 self-center"
          onPress={() => ref.current?.dismiss()}
        >
          <GarlandButtonText>Not now</GarlandButtonText>
        </GarlandButton>
      </BottomSheetView>
    </BottomSheetModal>
  )
}

// Used by variant A: About as its own little sheet.
export function AboutSheet({
  sheetRef,
}: {
  sheetRef: React.RefObject<BottomSheetModal | null>
}) {
  const insets = useSafeAreaInsets()
  return (
    <BottomSheetModal
      ref={sheetRef}
      enableDynamicSizing
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: garland.paper }}
      handleIndicatorStyle={{ backgroundColor: garland.ink40 }}
    >
      <BottomSheetView
        style={{ paddingHorizontal: 22, paddingBottom: insets.bottom + 16 }}
      >
        <Text className="text-[11px] font-bold uppercase tracking-[1.1px] text-garland-ink-40">
          About
        </Text>
        <Text className="mt-3 font-garland-display text-[28px] text-garland-ink">
          Prezentowo
        </Text>
        <Text className="mt-1 text-sm text-garland-ink-60">
          Version {appVersion()}
        </Text>
        <View className="mt-4 border-t border-garland-ink-08">
          <SettingsRow label="Privacy policy" onPress={openPrivacy} />
          <SettingsRow label="Terms of use" onPress={openTerms} last />
        </View>
      </BottomSheetView>
    </BottomSheetModal>
  )
}
