import type { EventDoc } from '@prezentowo/types'
import { router, useNavigation } from 'expo-router'
import { DrawerActions } from 'expo-router/react-navigation'
import { useTranslation } from 'react-i18next'
import { View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { activityLines } from '@/api/activityFeed'
import { recipientOptions } from '@/api/giftWizard'
import { Text } from '@/components/ui/text'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useEventActivity } from '@/hooks/useEventActivity'
import { useEventById } from '@/hooks/useEventById'
import { useEventGifts } from '@/hooks/useEventGifts'
import { useEventParticipants } from '@/hooks/useEventParticipants'
import { ActivityFeedItem } from '@/ui/components/ActivityFeedItem'
import { EventCover } from '@/ui/components/EventCover'
import { ScreenHeader } from '@/ui/components/ScreenHeader'
import { personSectionParams } from '@/ui/screens/PersonPresentsScreen'

// `3c`–`3c4`: the event's cover over its feed.
export function EventFeedScreen({ eventId }: { eventId: string }) {
  const { t } = useTranslation()
  const { event, ready } = useEventById(eventId)

  if (!event) {
    return (
      <SafeAreaView className="flex-1 bg-garland-paper">
        <ScreenHeader title={t('shell.activity')} />
        <View className="flex-1 items-center justify-center px-7">
          <Text className="text-center text-sm text-garland-ink-60">
            {ready ? t('feed.notFound') : t('feed.loading')}
          </Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <EventCover event={event}>
      <ActivityList event={event} />
    </EventCover>
  )
}

// The feed: every activity item the viewer may see, newest first.
function ActivityList({ event }: { event: EventDoc }) {
  const { t } = useTranslation()
  const user = useCurrentUser()
  const { items, ready } = useEventActivity(event._id)
  const { gifts } = useEventGifts(event._id)
  const { resolve } = useEventParticipants(event._id)
  const navigation = useNavigation()
  const now = new Date()

  const lines = activityLines(event, items, user?._id)

  const openGift = (giftId: string) =>
    router.push({
      pathname: '/event/[eventId]/gift/[giftId]',
      params: { eventId: event._id, giftId },
    })
  // A person is another section of the event, so it's switched to, not
  // pushed: back from there leaves the event.
  const openPerson = (participantId: string) =>
    navigation.dispatch(
      DrawerActions.jumpTo(
        'person/[participantId]',
        personSectionParams(event._id, participantId),
      ),
    )

  return (
    <View className="gap-2.5 pt-5">
      <Text className="mt-1 text-[11px] font-bold uppercase tracking-[1.1px] text-garland-ink-40">
        {t('shell.activity')}
      </Text>

      {lines.length === 0 ? (
        <Text className="py-6 text-center text-sm text-garland-ink-60">
          {ready ? t('feed.empty') : t('feed.loading')}
        </Text>
      ) : (
        lines.map(({ item, line }) => {
          const gift =
            'giftId' in line
              ? gifts.find(g => g._id === line.giftId)
              : undefined
          const actor = resolve(line.actorId)
          return (
            <ActivityFeedItem
              key={item._id}
              line={line}
              createdAt={item.createdAt}
              now={now}
              actor={actor}
              recipient={
                'recipientId' in line && line.recipientId
                  ? resolve(line.recipientId)
                  : undefined
              }
              gift={gift}
              // A present opens while it's still there; a join opens the
              // person's list while they're still in the event, if they
              // have one (not in a many-to-one event, bar the beneficiary).
              onPress={
                gift
                  ? () => openGift(gift._id)
                  : line.kind === 'joined' &&
                      actor &&
                      recipientOptions(event).includes(actor.id)
                    ? () => openPerson(actor.id)
                    : undefined
              }
            />
          )
        })
      )}
    </View>
  )
}
