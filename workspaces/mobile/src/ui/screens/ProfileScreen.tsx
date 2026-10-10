import * as Application from 'expo-application'
import type { ComponentType, ReactNode } from 'react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { uploadImage, uploadImageUrl } from '@/api/images'
import { formatJoined, versionLabel } from '@/api/profile'
import { updateUser } from '@/api/users'
import {
  CheckIcon,
  ChevronIcon,
  CloseIcon,
  GlobeIcon,
  PencilIcon,
} from '@/components/ui/icon'
import { Text } from '@/components/ui/text'
import { type AvatarKey, avatar } from '@/constants/avatars'
import { garland } from '@/constants/colors'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useOffline } from '@/hooks/useOffline'
import { useOpenLegalPage } from '@/hooks/useOpenLegalPage'
import { usePhotoPrompt } from '@/hooks/usePhotoPrompt'
import { useSignOut } from '@/hooks/useSignOut'
import { useLanguageModal } from '@/localization/LanguageModalProvider'
import { errorMessage } from '@/localization/errorMessage'
import { LOCALES } from '@/localization/provider'
import { Avatar } from '@/ui/components/Avatar'
import {
  AvatarPickerModal,
  type AvatarPickerModalHandle,
} from '@/ui/components/AvatarPickerModal'
import { ScreenHeader } from '@/ui/components/ScreenHeader'

type PictureOverride =
  | { kind: 'stock'; key: AvatarKey }
  // A photo's local uri, shown while it uploads and saves.
  | { kind: 'photo'; uri: string }
  // "Remove photo", shown while it saves.
  | { kind: 'removed' }

type IconComponent = ComponentType<{
  width?: number
  height?: number
  color?: string
}>

const VERSION = versionLabel(
  Application.nativeApplicationVersion,
  Application.nativeBuildVersion,
)

// The name and its field share one size, so editing doesn't jump.
const NAME_TEXT =
  'font-garland-display text-[32px] leading-[36px] text-garland-ink'

// Layout B, "Grouped cards" (docs/spec.md §10.1).
export function ProfileScreen() {
  const { t, i18n } = useTranslation()
  const offline = useOffline()
  const { unsynced, confirmSignOut } = useSignOut()
  const { open: openLanguageModal } = useLanguageModal()
  const avatarPickerRef = useRef<AvatarPickerModalHandle>(null)
  // Show the saved picture, but optimistically override it from the instant
  // the user picks a new one until the save settles.
  const [override, setOverride] = useState<PictureOverride | null>(null)
  const [savingPhoto, setSavingPhoto] = useState(false)

  const user = useCurrentUser()

  const avatarKey =
    (override?.kind === 'stock' ? override.key : undefined) ??
    (user?.profile?.avatar as AvatarKey | undefined) ??
    'm1'
  const savedPhoto = user?.profile?.photo
  const pictureUri = override
    ? override.kind === 'photo'
      ? override.uri
      : undefined
    : savedPhoto && uploadImageUrl(savedPhoto, 400)

  const savePicture = (args: { avatar?: AvatarKey; photo: null }) =>
    updateUser(args)
      .catch(err =>
        Alert.alert(
          t('profile.photoFailed'),
          errorMessage(err, t('common.somethingWentWrong')),
        ),
      )
      // Either way the override goes: the user document carries what's saved.
      .finally(() => setOverride(null))

  // A stock avatar replaces the photo, which the server then deletes
  // (docs/spec.md §1.10).
  const pickAvatar = (key: AvatarKey) => {
    setOverride({ kind: 'stock', key })
    void savePicture({ avatar: key, photo: null })
  }

  // Back to the stock avatar.
  const removePhoto = () => {
    setOverride({ kind: 'removed' })
    void savePicture({ photo: null })
  }

  const savePhoto = async (uri: string) => {
    setOverride({ kind: 'photo', uri })
    setSavingPhoto(true)
    try {
      const { id } = await uploadImage(uri)
      await updateUser({ photo: id })
    } catch (err) {
      Alert.alert(
        t('profile.photoFailed'),
        errorMessage(err, t('common.somethingWentWrong')),
      )
    } finally {
      setOverride(null)
      setSavingPhoto(false)
    }
  }
  const photoPrompt = usePhotoPrompt(uri => void savePhoto(uri), {
    square: true,
  })

  const openLegalPage = useOpenLegalPage()

  const displayName = user?.profile?.name ?? t('profile.friend')
  const email = user?.emails?.[0]?.address
  const joinedLabel = formatJoined(user?.createdAt, i18n.language)
  const localeLabel =
    LOCALES.find(l => l.code === i18n.language)?.label ?? 'English'

  return (
    <SafeAreaView className="flex-1 bg-garland-paper">
      <ScreenHeader title={t('shell.profile')} />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="mt-3 items-center">
          <Pressable
            onPress={() => {
              photoPrompt.clearError()
              avatarPickerRef.current?.present()
            }}
            disabled={offline || savingPhoto}
            accessibilityRole="button"
            accessibilityLabel={t('profile.changePicture')}
            accessibilityState={{ disabled: offline, busy: savingPhoto }}
            className={offline ? 'opacity-40' : 'active:opacity-70'}
          >
            <Avatar
              source={pictureUri ? { uri: pictureUri } : avatar(avatarKey)}
              size={104}
            />
            {savingPhoto ? (
              <View className="absolute inset-0 items-center justify-center rounded-full bg-[rgba(255,250,242,0.5)]">
                <ActivityIndicator color={garland.ink} />
              </View>
            ) : null}
            <View className="absolute bottom-0 right-0 rounded-full bg-garland-ink px-2 py-1">
              <Text className="text-[10px] font-bold uppercase text-garland-paper">
                {t('profile.editBadge')}
              </Text>
            </View>
          </Pressable>
          {photoPrompt.error ? (
            <Text className="mt-2 text-xs text-garland-berry">
              {t(`photoPicker.errors.${photoPrompt.error}`)}
            </Text>
          ) : null}
          <View className="mt-4 self-stretch px-4">
            <EditableName name={displayName} disabled={offline} />
          </View>
          {email ? (
            <Text className="mt-1 text-sm text-garland-ink-60">{email}</Text>
          ) : null}
          {joinedLabel ? (
            <Text className="text-xs text-garland-ink-40">
              {t('profile.joined', { joinedLabel })}
            </Text>
          ) : null}
        </View>

        <View className="mt-6 flex-row gap-2.5">
          <Stat value="04" label={t('profile.statEvents')} />
          <Stat value="17" label={t('profile.statWished')} />
          <Stat value="09" label={t('profile.statClaimed')} />
        </View>

        <Card>
          <SettingsRow
            Icon={GlobeIcon}
            label={t('common.language')}
            sublabel={localeLabel}
            onPress={openLanguageModal}
            last
          />
        </Card>

        <Card title={t('profile.about')}>
          {VERSION ? (
            <SettingsRow label={t('profile.version')} sublabel={VERSION} />
          ) : null}
          <SettingsRow
            label={t('profile.privacy')}
            onPress={() => openLegalPage('privacy')}
          />
          <SettingsRow
            label={t('profile.terms')}
            onPress={() => openLegalPage('terms')}
            last
          />
        </Card>

        <Card>
          <SettingsRow
            label={t('profile.signOut')}
            sublabel={
              unsynced > 0
                ? t('profile.unsynced', { count: unsynced })
                : undefined
            }
            tone="berry"
            onPress={confirmSignOut}
            chevron={false}
            last
          />
        </Card>
      </ScrollView>

      <AvatarPickerModal
        ref={avatarPickerRef}
        // With a photo up, no stock avatar is preselected: Accept would
        // replace the photo.
        value={pictureUri ? null : avatarKey}
        onConfirm={pickAvatar}
        onPhoto={photoPrompt.prompt}
        onRemovePhoto={pictureUri ? removePhoto : undefined}
      />
    </SafeAreaView>
  )
}

// The name, swapped for a field in place while editing: ✕ cancels, ✓ saves.
// Name only; an empty name can't be saved.
function EditableName({ name, disabled }: { name: string; disabled: boolean }) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cancel = () => {
    setDraft(null)
    setError(null)
  }

  if (draft === null) {
    return (
      <Pressable
        onPress={() => setDraft(name)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={t('profile.editName')}
        accessibilityState={{ disabled }}
        className={`flex-row items-center justify-center gap-2 ${
          disabled ? 'opacity-40' : 'active:opacity-70'
        }`}
      >
        <Text className={`shrink text-center ${NAME_TEXT}`}>{name}</Text>
        <PencilIcon width={18} height={18} color={garland.ink40} />
      </Pressable>
    )
  }

  const trimmed = draft.trim()
  // Going offline mid-edit keeps the draft but stops the save.
  const canSave = !!trimmed && !saving && !disabled

  const save = async () => {
    if (!canSave) return
    setSaving(true)
    setError(null)
    try {
      await updateUser({ name: trimmed })
      setDraft(null)
    } catch (err) {
      setError(errorMessage(err, t('common.somethingWentWrong')))
    } finally {
      setSaving(false)
    }
  }

  return (
    <View>
      <View className="flex-row items-center gap-2">
        <TextInput
          value={draft}
          onChangeText={setDraft}
          autoFocus
          editable={!saving}
          autoCapitalize="words"
          textContentType="name"
          returnKeyType="done"
          onSubmitEditing={() => void save()}
          accessibilityLabel={t('profile.nameLabel')}
          className={`flex-1 border-b-2 border-garland-ink pb-1 text-center ${NAME_TEXT}`}
        />
        <Pressable
          onPress={cancel}
          disabled={saving}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('profile.cancelName')}
          className="size-9 items-center justify-center rounded-full bg-garland-ink-08"
        >
          <CloseIcon width={16} height={16} color={garland.ink} />
        </Pressable>
        <Pressable
          onPress={() => void save()}
          disabled={!canSave}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('profile.saveName')}
          accessibilityState={{ disabled: !canSave, busy: saving }}
          className={`size-9 items-center justify-center rounded-full bg-garland-ink ${
            canSave ? '' : 'opacity-40'
          }`}
        >
          {saving ? (
            <ActivityIndicator size="small" color={garland.paper} />
          ) : (
            <CheckIcon width={16} height={16} color={garland.paper} />
          )}
        </Pressable>
      </View>
      {error ? (
        <Text className="mt-2 text-center text-xs text-garland-berry">
          {error}
        </Text>
      ) : null}
    </View>
  )
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View className="flex-1 items-center rounded-2xl bg-garland-paper2 py-4">
      <Text className="text-[28px] font-light text-garland-ink">{value}</Text>
      <Text className="mt-0.5 text-[10px] font-bold uppercase tracking-[1px] text-garland-ink-40">
        {label}
      </Text>
    </View>
  )
}

function Card({ title, children }: { title?: string; children: ReactNode }) {
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

// Without `onPress` the row is plain text, not a button.
function SettingsRow({
  Icon,
  label,
  sublabel,
  onPress,
  last,
  tone = 'ink',
  chevron = !!onPress,
}: {
  Icon?: IconComponent
  label: string
  sublabel?: string
  onPress?: () => void
  last?: boolean
  tone?: 'ink' | 'berry'
  chevron?: boolean
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      className={`flex-row items-center gap-3 py-3.5 active:opacity-60 ${
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
      {chevron ? (
        <ChevronIcon width={14} height={14} color={garland.ink40} />
      ) : null}
    </Pressable>
  )
}
