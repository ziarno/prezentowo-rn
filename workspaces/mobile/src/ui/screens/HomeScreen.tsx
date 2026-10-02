import { router } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { FlatList, Pressable, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { sortForHome } from '@/api/eventList'
import { BellIcon, PlusIcon } from '@/components/ui/icon'
import { Text } from '@/components/ui/text'
import { garland } from '@/constants/colors'
import { useMyEvents } from '@/hooks/useMyEvents'
import { useOffline } from '@/hooks/useOffline'
import { useRecentActivitySubscription } from '@/hooks/useRecentActivity'
import { useHasUnreadNotifications } from '@/hooks/useUnreadNotifications'
import { EventCard } from '@/ui/components/EventCard'
import { GarlandButton, GarlandButtonText } from '@/ui/components/GarlandButton'
import { ScreenHeader } from '@/ui/components/ScreenHeader'

const openCreateEvent = () => router.push('/create-event')
const openNotifications = () => router.push('/notifications')

// The ScreenHeader's bell, with a dot while something is unread.
function NotificationsBell() {
  const { t } = useTranslation()
  const unread = useHasUnreadNotifications()
  return (
    <Pressable
      onPress={openNotifications}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel={
        unread ? t('home.notificationsUnread') : t('shell.notifications')
      }
    >
      <BellIcon width={22} height={22} color={garland.ink} />
      {unread ? (
        <View
          testID="notifications-unread-dot"
          className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border border-garland-paper bg-garland-berry"
        />
      ) : null}
    </Pressable>
  )
}

// `3a`: the signed-in user's events, each with its recent activity and
// opening its feed, and a ＋ FAB.
export function HomeScreen() {
  const { t } = useTranslation()
  const offline = useOffline()
  const { events, ready } = useMyEvents()
  useRecentActivitySubscription()

  return (
    <SafeAreaView className="flex-1 bg-garland-paper">
      <ScreenHeader title={t('shell.home')} right={<NotificationsBell />} />
      {events.length === 0 ? (
        <View className="flex-1 items-center justify-center gap-2 px-7">
          {ready ? (
            <>
              <Text className="text-center font-garland-display text-2xl text-garland-ink">
                {t('home.emptyTitle')}
              </Text>
              <Text className="mb-4 text-center text-sm text-garland-ink-60">
                {t('home.emptyBody')}
              </Text>
              <GarlandButton onPress={openCreateEvent} disabled={offline}>
                <GarlandButtonText>{t('home.emptyAction')}</GarlandButtonText>
              </GarlandButton>
            </>
          ) : (
            <Text className="text-center text-sm text-garland-ink-60">
              {t('home.loading')}
            </Text>
          )}
        </View>
      ) : (
        <FlatList
          data={sortForHome(events, new Date())}
          keyExtractor={event => event._id}
          renderItem={({ item }) => (
            <EventCard
              event={item}
              onPress={() =>
                router.push({
                  pathname: '/event/[eventId]',
                  params: { eventId: item._id },
                })
              }
            />
          )}
          contentContainerClassName="gap-3 px-[22px] pb-28 pt-2"
          showsVerticalScrollIndicator={false}
        />
      )}
      {/* Also while loading, so a slow first launch can still create. */}
      <Pressable
        onPress={openCreateEvent}
        disabled={offline}
        accessibilityRole="button"
        accessibilityLabel={t('shell.createEvent')}
        accessibilityState={{ disabled: offline }}
        className={`absolute bottom-10 right-[22px] h-14 w-14 items-center justify-center rounded-full bg-garland-ink shadow-md active:opacity-70 ${offline ? 'opacity-40' : ''}`}
      >
        <PlusIcon width={24} height={24} color={garland.paper} />
      </Pressable>
    </SafeAreaView>
  )
}
