import { router } from 'expo-router'
import type { ComponentType, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, ScrollView, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import {
  BellIcon,
  CalendarIcon,
  ChevronIcon,
  CloseIcon,
  GlobeIcon,
  HeartIcon,
  LockIcon,
  MoonIcon,
} from '@/components/ui/icon'
import { Text } from '@/components/ui/text'
import { avatar } from '@/constants/avatars'
import { garland } from '@/constants/colors'
import { useAuth } from '@/hooks/useAuth'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useLanguageModal } from '@/localization/LanguageModalProvider'
import { LOCALES } from '@/localization/provider'
import { Avatar } from '@/ui/components/Avatar'

type IconComponent = ComponentType<{
  width?: number
  height?: number
  color?: string
}>

export function ProfileScreen() {
  const { t, i18n } = useTranslation()
  const { signOut } = useAuth()
  const { open: openLanguageModal } = useLanguageModal()

  const user = useCurrentUser()

  const displayName = user?.profile?.name ?? t('profile.friend')
  const email = user?.emails?.[0]?.address
  const joinedLabel = formatJoined(user?.createdAt, i18n.language)
  const localeLabel =
    LOCALES.find(l => l.code === i18n.language)?.label ?? 'English'

  return (
    <SafeAreaView className="flex-1 bg-garland-paper">
      <View className="flex-row items-center justify-between px-[22px] pb-2 pt-3.5">
        <Pressable hitSlop={12}>
          <Text className="text-sm text-garland-ink-60">
            {t('profile.edit')}
          </Text>
        </Pressable>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <CloseIcon width={22} height={22} color={garland.ink} />
        </Pressable>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="mt-2">
          <Avatar source={avatar('m1')} size={84} />
          <Text className="mt-4 font-garland-display text-[36px] leading-[38px] text-garland-ink">
            {displayName}.
          </Text>
          {(email ?? joinedLabel) ? (
            <Text className="mt-1.5 text-sm text-garland-ink-60">
              {email}
              {email && joinedLabel ? ' · ' : ''}
              {joinedLabel ? t('profile.joined', { joinedLabel }) : null}
            </Text>
          ) : null}
        </View>

        <View className="mt-7 flex-row gap-6 border-y border-garland-ink-08 py-5">
          <Stat value="04" label={t('profile.statEvents')} />
          <Stat value="17" label={t('profile.statWished')} />
          <Stat value="09" label={t('profile.statGiven')} />
        </View>

        <SectionHeading>{t('profile.settings')}</SectionHeading>
        <View className="border-t border-garland-ink-08">
          <SettingsRow
            Icon={BellIcon}
            label={t('profile.notifications')}
            sublabel={t('profile.notificationsSub')}
          />
          <SettingsRow
            Icon={GlobeIcon}
            label={t('common.language')}
            sublabel={localeLabel}
            onPress={openLanguageModal}
          />
          <SettingsRow
            Icon={MoonIcon}
            label={t('profile.appearance')}
            sublabel={t('profile.appearanceSub')}
          />
          <SettingsRow
            Icon={CalendarIcon}
            label={t('profile.defaultReminder')}
            sublabel={t('profile.defaultReminderSub')}
            last
          />
        </View>

        <SectionHeading>{t('profile.account')}</SectionHeading>
        <View className="border-t border-garland-ink-08">
          <SettingsRow
            Icon={LockIcon}
            label={t('profile.security')}
            sublabel={t('profile.securitySub')}
          />
          <SettingsRow
            Icon={HeartIcon}
            label={t('profile.about')}
            sublabel="v2.4"
            last
          />
        </View>

        <Pressable
          onPress={() => signOut({ onError: () => {} })}
          hitSlop={12}
          className="mt-8 self-center"
        >
          <Text className="text-sm font-bold text-garland-berry">
            {t('profile.signOut')}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  )
}

function Stat({ value, label }: { value: string; label: string }) {
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

function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <Text className="mb-2.5 mt-7 text-[11px] font-bold uppercase tracking-[1.1px] text-garland-ink-40">
      {children}
    </Text>
  )
}

function SettingsRow({
  Icon,
  label,
  sublabel,
  onPress,
  last,
}: {
  Icon: IconComponent
  label: string
  sublabel: string
  onPress?: () => void
  last?: boolean
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center gap-3 py-3.5 ${
        last ? '' : 'border-b border-garland-ink-08'
      }`}
    >
      <View className="size-9 items-center justify-center">
        <Icon width={20} height={20} color={garland.ink} />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="text-[15px] font-semibold text-garland-ink">
          {label}
        </Text>
        <Text className="mt-0.5 text-xs text-garland-ink-40">{sublabel}</Text>
      </View>
      <ChevronIcon width={14} height={14} color={garland.ink40} />
    </Pressable>
  )
}

function formatJoined(
  createdAt: Date | string | undefined,
  locale: string,
): string | null {
  if (!createdAt) return null
  const date = createdAt instanceof Date ? createdAt : new Date(createdAt)
  if (Number.isNaN(date.getTime())) return null
  const month = new Intl.DateTimeFormat(locale, { month: 'short' }).format(date)
  const year = date.getFullYear().toString().slice(-2)
  return `${month} '${year}`
}
