import { router, useGlobalSearchParams, useSegments } from 'expo-router'
import type { DrawerContentComponentProps } from 'expo-router/drawer'
import type { ComponentType, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, ScrollView, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import {
  BackIcon,
  BellIcon,
  ChatIcon,
  GlobeIcon,
  PencilIcon,
  PlusIcon,
} from '@/components/ui/icon'
import { Text } from '@/components/ui/text'
import { type AvatarKey, avatar } from '@/constants/avatars'
import { garland } from '@/constants/colors'
import { useAuth } from '@/hooks/useAuth'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useEventById } from '@/hooks/useEventById'
import { useEventParticipants } from '@/hooks/useEventParticipants'
import { useLanguageModal } from '@/localization/LanguageModalProvider'
import { LOCALES } from '@/localization/provider'
import { Avatar } from '@/ui/components/Avatar'
import { PeopleDrawer } from '@/ui/components/PeopleDrawer'

type IconComponent = ComponentType<{
  width?: number
  height?: number
  color?: string
}>

// The drawer is contextual: the event menu (`3d`/`3d2`) anywhere under
// `event/[eventId]`, the Home menu (`3b`) everywhere else.
export function AppDrawerContent({ navigation }: DrawerContentComponentProps) {
  const segments: string[] = useSegments()
  const { eventId } = useGlobalSearchParams<{ eventId?: string }>()
  const eventIndex = segments.indexOf('event')
  const inEvent = eventIndex !== -1 && segments[eventIndex + 1] === '[eventId]'

  // Close first so the drawer isn't left open over the screen we land on.
  const go = (navigate: () => void) => {
    navigation.closeDrawer()
    navigate()
  }

  return (
    <SafeAreaView className="flex-1 bg-garland-paper">
      <ScrollView
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {inEvent && eventId ? (
          // Keyed so switching events remounts it: its Meteor trackers keep
          // the eventId they were first rendered with.
          <EventMenu key={eventId} eventId={eventId} go={go} />
        ) : (
          <HomeMenu go={go} />
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

type MenuProps = { go: (navigate: () => void) => void }

function HomeMenu({ go }: MenuProps) {
  const { t, i18n } = useTranslation()
  const { signOut } = useAuth()
  const { open: openLanguageModal } = useLanguageModal()
  const user = useCurrentUser()

  const avatarKey = (user?.profile?.avatar as AvatarKey | undefined) ?? 'm1'
  const email = user?.emails?.[0]?.address
  const localeLabel =
    LOCALES.find(l => l.code === i18n.language)?.label ?? 'English'

  return (
    <>
      <Pressable
        onPress={() => go(() => router.push('/profile'))}
        accessibilityRole="button"
        accessibilityLabel={t('shell.profile')}
        className="flex-row items-center gap-3.5 px-[22px] pb-5 pt-4 active:opacity-70"
      >
        <Avatar source={avatar(avatarKey)} size={48} />
        <View className="min-w-0 flex-1">
          <Text
            className="text-[17px] font-bold text-garland-ink"
            numberOfLines={1}
          >
            {user?.profile?.name ?? t('profile.friend')}
          </Text>
          {email ? (
            <Text
              className="mt-0.5 text-[13px] text-garland-ink-60"
              numberOfLines={1}
            >
              {email}
            </Text>
          ) : null}
        </View>
      </Pressable>

      <MenuSection>
        <MenuRow
          Icon={BellIcon}
          label={t('shell.notifications')}
          onPress={() => go(() => router.push('/notifications'))}
        />
        <MenuRow
          Icon={GlobeIcon}
          label={t('common.language')}
          detail={localeLabel}
          onPress={() => go(openLanguageModal)}
        />
      </MenuSection>

      <Pressable
        onPress={() => go(() => signOut({ onError: () => {} }))}
        hitSlop={12}
        accessibilityRole="button"
        className="mt-8 self-start px-[22px]"
      >
        <Text className="text-sm font-bold text-garland-berry">
          {t('profile.signOut')}
        </Text>
      </Pressable>
    </>
  )
}

function EventMenu({ eventId, go }: MenuProps & { eventId: string }) {
  const { t } = useTranslation()
  const event = useEventById(eventId)
  const { participants } = useEventParticipants(eventId)

  return (
    <>
      <View className="px-[22px] pb-2 pt-4">
        <Text className="text-[11px] font-bold uppercase tracking-[1.1px] text-garland-ink-40">
          {event?.title ?? ' '}
        </Text>
      </View>

      <MenuSection>
        <MenuRow
          Icon={BackIcon}
          label={t('shell.backHome')}
          onPress={() => go(() => router.dismissTo('/'))}
        />
        <MenuRow
          Icon={PencilIcon}
          label={t('shell.editEvent')}
          onPress={() =>
            go(() =>
              router.push({
                pathname: '/event/[eventId]/edit',
                params: { eventId },
              }),
            )
          }
        />
        <MenuRow
          Icon={BellIcon}
          label={t('shell.activity')}
          onPress={() =>
            go(() =>
              router.dismissTo({
                pathname: '/event/[eventId]',
                params: { eventId },
              }),
            )
          }
        />
        <MenuRow
          Icon={ChatIcon}
          label={t('shell.chat')}
          onPress={() =>
            go(() =>
              router.push({
                pathname: '/event/[eventId]/chat',
                params: { eventId },
              }),
            )
          }
        />
      </MenuSection>

      <Text className="mb-1.5 mt-7 px-[22px] text-[11px] font-bold uppercase tracking-[1.1px] text-garland-ink-40">
        {t('shell.people')}
      </Text>
      <PeopleDrawer
        people={participants}
        onSelectPerson={participantId =>
          go(() =>
            router.push({
              pathname: '/event/[eventId]/person/[participantId]',
              params: { eventId, participantId },
            }),
          )
        }
      />
      {/* Sharing the invite link lands with the invites slice. */}
      <View className="border-t border-garland-ink-08">
        <MenuRow Icon={PlusIcon} label={t('shell.invitePeople')} />
      </View>
    </>
  )
}

function MenuSection({ children }: { children: ReactNode }) {
  return <View className="border-t border-garland-ink-08">{children}</View>
}

function MenuRow({
  Icon,
  label,
  detail,
  onPress,
}: {
  Icon: IconComponent
  label: string
  detail?: string
  onPress?: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className="flex-row items-center gap-3 border-b border-garland-ink-08 px-[22px] py-3.5 active:opacity-70"
    >
      <Icon width={20} height={20} color={garland.ink} />
      <Text className="flex-1 text-[15px] font-semibold text-garland-ink">
        {label}
      </Text>
      {detail ? (
        <Text className="text-[13px] text-garland-ink-40">{detail}</Text>
      ) : null}
    </Pressable>
  )
}
