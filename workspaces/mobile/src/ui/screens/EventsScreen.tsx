import { Trans } from '@lingui/react/macro'
import { router } from 'expo-router'
import { Pressable, ScrollView, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import type { EventListItem } from '@/api/events'
import { useMyEvents } from '@/hooks/useMyEvents'
import { ArrowRightIcon, BellIcon, PlusIcon } from '@/components/ui/icon'
import { Text } from '@/components/ui/text'
import { avatar } from '@/constants/avatars'
import { garland } from '@/constants/colors'
import { Avatar } from '@/ui/components/Avatar'

const ACCENT_PALETTE = [
  garland.green,
  garland.berry,
  garland.moss,
  garland.amber,
]

export function EventsScreen() {
  const events = useMyEvents()

  return (
    <SafeAreaView className="flex-1 bg-garland-paper">
      <View className="flex-1">
        <View className="flex-row items-center justify-between px-[22px] pb-2 pt-3.5">
          <Pressable onPress={() => router.push('/profile')} hitSlop={8}>
            <Avatar source={avatar('m1')} size={32} />
          </Pressable>
          <Text className="font-garland-display text-lg text-garland-ink">
            <Trans>Prezentowo</Trans>
          </Text>
          <Pressable hitSlop={8}>
            <BellIcon width={22} height={22} color={garland.ink60} />
            <View className="absolute -right-0.5 -top-0.5 size-2 rounded-full border-[1.5px] border-garland-paper bg-garland-berry" />
          </Pressable>
        </View>

        <View className="px-[22px]">
          <Text className="mb-1.5 mt-[22px] text-[11px] font-bold uppercase tracking-[1.1px] text-garland-ink-40">
            <Trans>Your events</Trans>
          </Text>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingTop: 14, paddingBottom: 110 }}
          showsVerticalScrollIndicator={false}
        >
          {events.length === 0 ? (
            <View className="px-[22px] pt-6">
              <Text className="text-sm text-garland-ink-60">
                <Trans>
                  No events yet. Tap the + button to create your first one.
                </Trans>
              </Text>
            </View>
          ) : (
            events.map((event, idx) => (
              <EventRow
                key={event._id}
                event={event}
                accent={ACCENT_PALETTE[idx % ACCENT_PALETTE.length]!}
              />
            ))
          )}
        </ScrollView>

        <View className="absolute bottom-9 right-[18px]">
          <Pressable
            onPress={() => router.push('/create-event')}
            className="size-14 items-center justify-center rounded-full bg-garland-ink"
            style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.4,
              shadowRadius: 12,
              elevation: 8,
            }}
          >
            <PlusIcon width={22} height={22} color={garland.paper} />
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  )
}

function EventRow({ event, accent }: { event: EventListItem; accent: string }) {
  return (
    <Pressable
      onPress={() => router.push(`/join-event?eventId=${event._id}`)}
      className="flex-row items-center gap-3.5 border-t border-garland-ink-08 px-[22px] py-4"
    >
      <View
        className="self-stretch rounded"
        style={{ width: 8, backgroundColor: accent }}
      />
      <View className="min-w-0 flex-1">
        <Text className="text-[11px] font-bold uppercase tracking-[1px] text-garland-ink-40">
          {event.date}
        </Text>
        <Text className="mt-0.5 text-[17px] font-bold leading-[21px] text-garland-ink">
          {event.title}
        </Text>
        <Text className="mt-1 text-[13px] text-garland-ink-60">
          <Trans>{event.participants.length} people</Trans>
        </Text>
      </View>
      <ArrowRightIcon width={22} height={22} color={garland.ink40} />
    </Pressable>
  )
}
