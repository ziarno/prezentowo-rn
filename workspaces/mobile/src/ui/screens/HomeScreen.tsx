import { router } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { FlatList, Pressable, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { PlusIcon } from '@/components/ui/icon'
import { Text } from '@/components/ui/text'
import { garland } from '@/constants/colors'
import { useMyEvents } from '@/hooks/useMyEvents'
import { EventCard } from '@/ui/components/EventCard'
import { GarlandButton, GarlandButtonText } from '@/ui/components/GarlandButton'
import { ScreenHeader } from '@/ui/components/ScreenHeader'

const openCreateEvent = () => router.push('/create-event')

// `3a`: the signed-in user's events, each opening its feed, and a ＋ FAB.
export function HomeScreen() {
  const { t } = useTranslation()
  const { events, ready } = useMyEvents()

  return (
    <SafeAreaView className="flex-1 bg-garland-paper">
      <ScreenHeader title={t('shell.home')} />
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
              <GarlandButton onPress={openCreateEvent}>
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
          data={events}
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
      {/* Also while loading, so an offline first launch can still create. */}
      <Pressable
        onPress={openCreateEvent}
        accessibilityRole="button"
        accessibilityLabel={t('shell.createEvent')}
        className="absolute bottom-10 right-[22px] h-14 w-14 items-center justify-center rounded-full bg-garland-ink shadow-md active:opacity-70"
      >
        <PlusIcon width={24} height={24} color={garland.paper} />
      </Pressable>
    </SafeAreaView>
  )
}
