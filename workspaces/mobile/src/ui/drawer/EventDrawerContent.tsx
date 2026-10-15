import { router } from 'expo-router'
import type { DrawerContentComponentProps } from 'expo-router/drawer'
import type { ComponentType, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, ScrollView, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { beneficiaryIdOf } from '@/api/events'
import { presentCounts } from '@/api/presentLists'
import { BackIcon, BellIcon, ChatIcon, PencilIcon } from '@/components/ui/icon'
import { Text } from '@/components/ui/text'
import { garland } from '@/constants/colors'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useEventById } from '@/hooks/useEventById'
import { useEventGifts } from '@/hooks/useEventGifts'
import { useEventParticipants } from '@/hooks/useEventParticipants'
import { useOffline } from '@/hooks/useOffline'
import { PeopleDrawer } from '@/ui/components/PeopleDrawer'

type IconComponent = ComponentType<{
  width?: number
  height?: number
  color?: string
}>

// The event menu (`3d`/`3d2`): the drawer of an event's sections, the only
// screens that open it. Home goes to Profile from its avatar instead.
// Sections are jumped between, so they leave no history; what isn't a
// section (editing) is pushed over the drawer.
export function EventDrawerContent({
  navigation,
  state,
  eventId,
}: DrawerContentComponentProps & { eventId: string }) {
  const open = state.routes[state.index]
  const current: Current = {
    section: open?.name,
    participantId: (open?.params as { participantId?: string } | undefined)
      ?.participantId,
  }
  // Close first so the drawer isn't left open over the screen we land on.
  const go = (navigate: () => void) => {
    navigation.closeDrawer()
    navigate()
  }
  const jumpTo = (section: string, params?: Record<string, string>) =>
    go(() => navigation.jumpTo(section, { eventId, ...params }))

  return (
    <SafeAreaView className="flex-1 bg-garland-paper">
      <ScrollView
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        <EventMenu
          eventId={eventId}
          current={current}
          go={go}
          jumpTo={jumpTo}
        />
      </ScrollView>
    </SafeAreaView>
  )
}

// The section on screen, highlighted in the menu.
type Current = { section?: string; participantId?: string }

type MenuProps = {
  eventId: string
  current: Current
  go: (navigate: () => void) => void
  jumpTo: (section: string, params?: Record<string, string>) => void
}

function EventMenu({ eventId, current, go, jumpTo }: MenuProps) {
  const { t } = useTranslation()
  const { event } = useEventById(eventId)
  const { participants } = useEventParticipants(eventId)
  const { gifts } = useEventGifts(eventId)
  const user = useCurrentUser()
  const offline = useOffline()
  // Everyone gets a count and a list in `3d`. In `3d2` (many-to-one) the
  // beneficiary is listed first and is the only one with either.
  const counts = event ? presentCounts(event, gifts, user?._id) : {}
  const beneficiaryId = event ? beneficiaryIdOf(event) : undefined
  const people = participants
    .map(p => ({
      ...p,
      presentCount:
        !beneficiaryId || p.id === beneficiaryId ? counts[p.id] : undefined,
      canOpen: !beneficiaryId || p.id === beneficiaryId,
    }))
    // The viewer is always first, then the beneficiary.
    .sort(
      (a, b) =>
        Number(b.isYou) - Number(a.isYou) ||
        Number(b.id === beneficiaryId) - Number(a.id === beneficiaryId),
    )

  return (
    <>
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
          selected={current.section === 'index'}
          onPress={() => jumpTo('index')}
        />
        <MenuRow
          Icon={ChatIcon}
          label={t('shell.chat')}
          selected={current.section === 'chat'}
          onPress={() => jumpTo('chat')}
        />
      </MenuSection>

      <View className="mb-1.5 mt-7 flex-row items-baseline gap-1.5 px-[22px]">
        <Text className="text-[11px] font-bold uppercase tracking-[1.1px] text-garland-ink-40">
          {t('shell.people')}
        </Text>
        <Text className="text-[11px] font-bold tracking-[1.1px] text-garland-ink-40">
          {people.length}
        </Text>
      </View>
      <PeopleDrawer
        people={people}
        selectedId={
          current.section === 'person/[participantId]'
            ? current.participantId
            : undefined
        }
        onSelectPerson={participantId =>
          jumpTo('person/[participantId]', { participantId })
        }
      />
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
  selected = false,
}: {
  Icon: IconComponent
  label: string
  detail?: string
  onPress?: () => void
  disabled?: boolean
  selected?: boolean
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled, selected }}
      className={`flex-row items-center gap-3 border-b border-garland-ink-08 px-[22px] py-3.5 active:opacity-70 ${disabled ? 'opacity-40' : ''} ${selected ? 'bg-garland-paper2' : ''}`}
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
