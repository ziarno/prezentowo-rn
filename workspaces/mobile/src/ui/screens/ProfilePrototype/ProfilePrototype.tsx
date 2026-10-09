// PROTOTYPE (#86) — throwaway. Three Profile layouts on the real /profile
// route, switched from the floating bar; ⚙ fakes permission, offline,
// queued writes and your own photo.
import type { BottomSheetModal } from '@gorhom/bottom-sheet'
import { useRef, useState } from 'react'
import { Alert, Pressable, ScrollView, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { BellIcon, GlobeIcon, HeartIcon } from '@/components/ui/icon'
import { Text } from '@/components/ui/text'
import { Avatar } from '@/ui/components/Avatar'
import {
  AvatarPickerModal,
  type AvatarPickerModalHandle,
} from '@/ui/components/AvatarPickerModal'
import { ScreenHeader } from '@/ui/components/ScreenHeader'

import { PrototypeBar } from './PrototypeBar'
import {
  AboutSheet,
  DeleteAccountModal,
  EditableName,
  OfflineStrip,
  PrePromptSheet,
  QueuedNote,
  STATS,
  SectionHeading,
  SettingsRow,
  Stat,
  appVersion,
  confirmSignOut,
  openPrivacy,
  openPushSettings,
  openTerms,
  useProfileData,
} from './parts'
import { setProto, useProto } from './store'

type Data = ReturnType<typeof useProfileData>
type Shared = {
  d: Data
  editing: boolean
  setEditing: (v: boolean) => void
  openAvatar: () => void
  openDelete: () => void
  queued: number
}

export function ProfilePrototype() {
  const s = useProto()
  const d = useProfileData()
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const avatarRef = useRef<AvatarPickerModalHandle>(null)

  const shared: Shared = {
    d,
    editing,
    setEditing,
    openAvatar: () => avatarRef.current?.present(),
    openDelete: () => setDeleting(true),
    queued: s.queued,
  }

  return (
    <SafeAreaView className="flex-1 bg-garland-paper">
      {s.variant === 'A' ? <VariantA {...shared} /> : null}
      {s.variant === 'B' ? <VariantB {...shared} /> : null}
      {s.variant === 'C' ? <VariantC {...shared} /> : null}

      <AvatarPickerModal
        ref={avatarRef}
        value={s.hasPhoto ? null : d.avatarKey}
        onConfirm={() => setProto({ hasPhoto: false })}
        onPhoto={() => Alert.alert('Prototype', 'Would open the photo picker.')}
        onRemovePhoto={
          s.hasPhoto ? () => setProto({ hasPhoto: false }) : undefined
        }
      />
      <DeleteAccountModal
        visible={deleting}
        onClose={() => setDeleting(false)}
        email={d.email}
      />
      <PrePromptSheet />
      <PrototypeBar showVariants />
    </SafeAreaView>
  )
}

// A — Ledger: today's screen, finished. Edit in the header swaps the name for
// a field; About opens a sheet; Delete account is a quiet link under Sign out.
function VariantA({
  d,
  editing,
  setEditing,
  openAvatar,
  openDelete,
  queued,
}: Shared) {
  const aboutRef = useRef<BottomSheetModal>(null)
  return (
    <>
      <ScreenHeader
        title="Profile"
        right={
          editing ? null : (
            <Pressable
              hitSlop={12}
              disabled={d.offline}
              onPress={() => setEditing(true)}
              style={{ opacity: d.offline ? 0.4 : 1 }}
            >
              <Text className="text-sm text-garland-ink-60">Edit</Text>
            </Pressable>
          )
        }
      />
      <OfflineStrip />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 140 }}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable
          onPress={openAvatar}
          disabled={d.offline}
          style={{ alignSelf: 'flex-start', opacity: d.offline ? 0.4 : 1 }}
          className="mt-2"
        >
          <Avatar source={d.avatarSource} size={84} />
        </Pressable>
        <View className="mt-4">
          <EditableName
            name={d.name}
            onSave={d.setName}
            editing={editing}
            setEditing={setEditing}
            disabled={d.offline}
          />
        </View>
        <Text className="mt-1.5 text-sm text-garland-ink-60">
          {d.email} · {d.joined}
        </Text>

        <View className="mt-7 flex-row gap-6 border-y border-garland-ink-08 py-5">
          {STATS.map(st => (
            <Stat key={st.label} {...st} />
          ))}
        </View>

        <SectionHeading>Settings</SectionHeading>
        <View className="border-t border-garland-ink-08">
          <SettingsRow
            Icon={BellIcon}
            label="Push notifications"
            sublabel={d.pushLabel}
            onPress={openPushSettings}
          />
          <SettingsRow
            Icon={GlobeIcon}
            label="Language"
            sublabel={d.language}
            onPress={d.openLanguage}
            last
          />
        </View>

        <SectionHeading>Account</SectionHeading>
        <View className="border-t border-garland-ink-08">
          <SettingsRow
            Icon={HeartIcon}
            label="About"
            sublabel={`Version ${appVersion()} · privacy · terms`}
            onPress={() => aboutRef.current?.present()}
            last
          />
        </View>

        <Pressable
          onPress={() => confirmSignOut(queued)}
          hitSlop={12}
          className="mt-8 self-center"
        >
          <Text className="text-sm font-bold text-garland-berry">Sign out</Text>
        </Pressable>
        <QueuedNote center />
        <Pressable
          onPress={openDelete}
          disabled={d.offline}
          hitSlop={12}
          className="mt-5 self-center"
          style={{ opacity: d.offline ? 0.4 : 1 }}
        >
          <Text className="text-xs text-garland-ink-40 underline">
            Delete account
          </Text>
        </Pressable>
      </ScrollView>
      <AboutSheet sheetRef={aboutRef} />
    </>
  )
}

// B — Grouped cards: centred identity, stats as tiles, settings in rounded
// groups, About laid out inline, Delete account in its own "Danger zone".
function VariantB({
  d,
  editing,
  setEditing,
  openAvatar,
  openDelete,
  queued,
}: Shared) {
  return (
    <>
      <ScreenHeader title="Profile" />
      <OfflineStrip />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 140 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="mt-3 items-center">
          <Pressable
            onPress={openAvatar}
            disabled={d.offline}
            style={{ opacity: d.offline ? 0.4 : 1 }}
          >
            <Avatar source={d.avatarSource} size={104} />
            <View className="absolute bottom-0 right-0 rounded-full bg-garland-ink px-2 py-1">
              <Text className="text-[10px] font-bold text-garland-paper">
                EDIT
              </Text>
            </View>
          </Pressable>
          <View className="mt-4 self-stretch px-4">
            <EditableName
              name={d.name}
              onSave={d.setName}
              editing={editing}
              setEditing={setEditing}
              disabled={d.offline}
              showPencil
              center
              className="text-center font-garland-display text-[32px] leading-[36px] text-garland-ink"
            />
          </View>
          <Text className="mt-1 text-sm text-garland-ink-60">{d.email}</Text>
          <Text className="text-xs text-garland-ink-40">{d.joined}</Text>
        </View>

        <View className="mt-6 flex-row gap-2.5">
          {STATS.map(st => (
            <View
              key={st.label}
              className="flex-1 items-center rounded-2xl bg-garland-paper2 py-4"
            >
              <Text className="text-[28px] font-light text-garland-ink">
                {st.value}
              </Text>
              <Text className="mt-0.5 text-[10px] font-bold uppercase tracking-[1px] text-garland-ink-40">
                {st.label}
              </Text>
            </View>
          ))}
        </View>

        <Card>
          <SettingsRow
            Icon={BellIcon}
            label="Push notifications"
            sublabel={d.pushLabel}
            onPress={openPushSettings}
          />
          <SettingsRow
            Icon={GlobeIcon}
            label="Language"
            sublabel={d.language}
            onPress={d.openLanguage}
            last
          />
        </Card>

        <Card title="About">
          <SettingsRow
            label="Version"
            sublabel={appVersion()}
            chevron={false}
          />
          <SettingsRow label="Privacy policy" onPress={openPrivacy} />
          <SettingsRow label="Terms of use" onPress={openTerms} last />
        </Card>

        <Card>
          <SettingsRow
            label="Sign out"
            tone="berry"
            chevron={false}
            onPress={() => confirmSignOut(queued)}
            sublabel={
              queued
                ? `${queued} offline change${queued === 1 ? '' : 's'} not synced yet`
                : undefined
            }
            last
          />
        </Card>

        <Card title="Danger zone">
          <SettingsRow
            label="Delete account"
            sublabel="Removes your account and claims for good."
            tone="berry"
            onPress={openDelete}
            disabled={d.offline}
            last
          />
        </Card>
      </ScrollView>
    </>
  )
}

function Card({
  title,
  children,
}: {
  title?: string
  children: React.ReactNode
}) {
  return (
    <View className="mt-5">
      {title ? (
        <Text className="mb-1.5 ml-2 text-[11px] font-bold uppercase tracking-[1.1px] text-garland-ink-40">
          {title}
        </Text>
      ) : null}
      <View className="rounded-2xl bg-garland-paper2 px-4">{children}</View>
    </View>
  )
}

// C — Account sheet: a compact identity row, stats as one sentence, a short
// flat list. Email, Sign out and Delete account all live behind "Account".
function VariantC({
  d,
  editing,
  setEditing,
  openAvatar,
  openDelete,
  queued,
}: Shared) {
  const [accountOpen, setAccountOpen] = useState(false)
  return (
    <>
      <ScreenHeader title="Profile" />
      <OfflineStrip />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 140 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="mt-3 flex-row items-center gap-4">
          <Pressable
            onPress={openAvatar}
            disabled={d.offline}
            style={{ opacity: d.offline ? 0.4 : 1 }}
          >
            <Avatar source={d.avatarSource} size={64} />
          </Pressable>
          <View className="min-w-0 flex-1">
            <EditableName
              name={d.name}
              onSave={d.setName}
              editing={editing}
              setEditing={setEditing}
              disabled={d.offline}
              showPencil
              className="font-garland-display text-[28px] leading-[32px] text-garland-ink"
            />
            <Text className="text-xs text-garland-ink-40">
              Tap your name or picture to change it
            </Text>
          </View>
        </View>

        <Text className="mt-6 text-[17px] leading-[26px] text-garland-ink">
          In <Text className="font-bold">{STATS[0].value} events</Text> you’ve
          wished for <Text className="font-bold">{STATS[1].value} gifts</Text>{' '}
          and claimed <Text className="font-bold">{STATS[2].value}</Text>.
        </Text>

        <View className="mt-6 border-t border-garland-ink-08">
          <SettingsRow
            Icon={BellIcon}
            label="Push notifications"
            sublabel={d.pushLabel}
            onPress={openPushSettings}
          />
          <SettingsRow
            Icon={GlobeIcon}
            label="Language"
            sublabel={d.language}
            onPress={d.openLanguage}
          />
          <SettingsRow
            Icon={HeartIcon}
            label="Account"
            sublabel={d.email}
            onPress={() => setAccountOpen(o => !o)}
          />
          {accountOpen ? (
            <View className="mb-2 rounded-2xl bg-garland-paper2 px-4">
              <SettingsRow
                label="Signed in as"
                sublabel={`${d.email} · ${d.joined}`}
                chevron={false}
              />
              <SettingsRow
                label="Sign out"
                tone="berry"
                chevron={false}
                onPress={() => confirmSignOut(queued)}
                sublabel={
                  queued
                    ? `${queued} offline change${queued === 1 ? '' : 's'} not synced yet`
                    : undefined
                }
              />
              <SettingsRow
                label="Delete account"
                tone="berry"
                onPress={openDelete}
                disabled={d.offline}
                last
              />
            </View>
          ) : null}
        </View>

        <View className="mt-10 items-center gap-1">
          <Text className="text-xs text-garland-ink-40">
            Prezentowo {appVersion()}
          </Text>
          <View className="flex-row gap-4">
            <Pressable onPress={openPrivacy} hitSlop={8}>
              <Text className="text-xs text-garland-ink-60 underline">
                Privacy
              </Text>
            </Pressable>
            <Pressable onPress={openTerms} hitSlop={8}>
              <Text className="text-xs text-garland-ink-60 underline">
                Terms
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </>
  )
}
