import type { EventDoc } from '@prezentowo/types'
import { type TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import { Pressable, View } from 'react-native'

import {
  type Countdown,
  avatarPreview,
  countdown,
  parseEventDate,
} from '@/api/eventList'
import { Text } from '@/components/ui/text'
import { garland } from '@/constants/colors'
import { useEventParticipants } from '@/hooks/useEventParticipants'
import { EventBackground } from '@/ui/components/EventBackground'
import { ParticipantAvatar } from '@/ui/components/ParticipantAvatar'

const AVATAR_SIZE = 28
const MAX_AVATARS = 5

const countdownText = (t: TFunction, c: Countdown): string =>
  'unit' in c
    ? t(`home.countdown.${c.kind}.${c.unit}`, { count: c.count })
    : t(`home.countdown.${c.kind}`)

// A `3a` row: the event's background band, then title, date with countdown,
// and who's taking part.
export function EventCard({
  event,
  onPress,
}: {
  event: EventDoc
  onPress: () => void
}) {
  const { t, i18n } = useTranslation()
  const { participants } = useEventParticipants(event._id)

  const date = parseEventDate(event.date)
  const until = countdown(event.date, new Date())
  const when = [
    date
      ? new Intl.DateTimeFormat(i18n.language, {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        }).format(date)
      : event.date,
    until && countdownText(t, until),
  ]
    .filter(Boolean)
    .join(' · ')

  const { shown, more } = avatarPreview(participants, MAX_AVATARS)
  const overlap = Math.round(AVATAR_SIZE * 0.3)
  const stackedSlot = (i: number) => ({
    marginLeft: i === 0 ? 0 : -overlap,
    padding: 2,
    borderRadius: (AVATAR_SIZE + 4) / 2,
    backgroundColor: garland.paper,
  })

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${event.title}, ${when}`}
      className="overflow-hidden rounded-2xl border border-garland-ink-08 bg-garland-paper active:opacity-70"
    >
      <EventBackground event={event} height={72} />
      <View className="gap-1 px-4 pb-3.5 pt-3">
        <Text
          className="font-garland-display text-xl text-garland-ink"
          numberOfLines={1}
        >
          {event.title}
        </Text>
        <Text className="text-[13px] text-garland-ink-60">{when}</Text>
        {participants.length > 0 ? (
          <View
            className="mt-1.5 flex-row"
            accessible
            accessibilityLabel={t('home.people', {
              count: participants.length,
            })}
          >
            {shown.map((person, i) => (
              <View key={person.id} style={stackedSlot(i)}>
                <ParticipantAvatar
                  name={person.name}
                  avatarKey={person.avatarKey}
                  color={person.color}
                  size={AVATAR_SIZE}
                />
              </View>
            ))}
            {more > 0 ? (
              <View style={stackedSlot(shown.length)}>
                <View
                  className="items-center justify-center rounded-full bg-garland-paper2"
                  style={{ width: AVATAR_SIZE, height: AVATAR_SIZE }}
                >
                  <Text className="text-[11px] font-semibold text-garland-ink-60">
                    {t('home.morePeople', { count: more })}
                  </Text>
                </View>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    </Pressable>
  )
}
