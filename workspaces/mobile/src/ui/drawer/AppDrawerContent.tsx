import { router, useGlobalSearchParams, useSegments } from 'expo-router'
import type { DrawerContentComponentProps } from 'expo-router/drawer'
import type { ComponentType, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, Pressable, ScrollView, Share, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { beneficiaryIdOf } from '@/api/events'
import { inviteLink } from '@/api/invites'
import { presentCounts } from '@/api/presentLists'
import {
  BackIcon,
  BellIcon,
  ChatIcon,
  PencilIcon,
  PlusIcon,
} from '@/components/ui/icon'
import { Text } from '@/components/ui/text'
import { garland } from '@/constants/colors'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useEventById } from '@/hooks/useEventById'
import { useEventGifts } from '@/hooks/useEventGifts'
import { useEventInvite } from '@/hooks/useEventInvite'
import { useEventParticipants } from '@/hooks/useEventParticipants'
import { useOffline } from '@/hooks/useOffline'
import { PeopleDrawer } from '@/ui/components/PeopleDrawer'

type IconComponent = ComponentType<{
  width?: number
  height?: number
  color?: string
}>

// The event menu (`3d`/`3d2`), for screens under `event/[eventId]` — the only
// ones that open the drawer. Home goes to Profile from its avatar instead.
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
        ) : null}
      </ScrollView>
    </SafeAreaView>
  )
}

type MenuProps = { go: (navigate: () => void) => void }

function EventMenu({ eventId, go }: MenuProps & { eventId: string }) {
  const { t } = useTranslation()
  const { event } = useEventById(eventId)
  const { participants } = useEventParticipants(eventId)
  const { gifts } = useEventGifts(eventId)
  const user = useCurrentUser()
  const invite = useEventInvite(eventId)
  const offline = useOffline()
  // Everyone gets a count in `3d`. In `3d2` (many-to-one) the beneficiary
  // is listed first and is the only one with a count.
  const counts = event ? presentCounts(event, gifts, user?._id) : {}
  const beneficiaryId = event ? beneficiaryIdOf(event) : undefined
  const people = participants
    .map(p => ({
      ...p,
      presentCount:
        !beneficiaryId || p.id === beneficiaryId ? counts[p.id] : undefined,
    }))
    .sort(
      (a, b) => Number(b.id === beneficiaryId) - Number(a.id === beneficiaryId),
    )

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
        {/* `6a` is the creator's. */}
        {event && event.ownerId === user?._id ? (
          <MenuRow
            Icon={PencilIcon}
            label={t('shell.editEvent')}
            disabled={offline}
            onPress={() =>
              go(() =>
                router.push({
                  pathname: '/event/[eventId]/edit',
                  params: { eventId },
                }),
              )
            }
          />
        ) : null}
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
        people={people}
        onSelectPerson={participantId =>
          go(() =>
            router.push({
              pathname: '/event/[eventId]/person/[participantId]',
              params: { eventId, participantId },
            }),
          )
        }
      />
      {/* Only the creator holds the invite code (`invites.forEvent`). */}
      {invite ? (
        <View className="border-t border-garland-ink-08">
          <MenuRow
            Icon={PlusIcon}
            label={t('shell.invitePeople')}
            onPress={() =>
              offline
                ? Alert.alert(t('offline.inviteTitle'), t('offline.inviteBody'))
                : go(() =>
                    Share.share({
                      message: t('invite.shareMessage', {
                        title: event?.title ?? '',
                        link: inviteLink(invite.code),
                      }),
                    }),
                  )
            }
          />
        </View>
      ) : null}
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
  disabled = false,
}: {
  Icon: IconComponent
  label: string
  detail?: string
  onPress?: () => void
  disabled?: boolean
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      className={`flex-row items-center gap-3 border-b border-garland-ink-08 px-[22px] py-3.5 active:opacity-70 ${disabled ? 'opacity-40' : ''}`}
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
