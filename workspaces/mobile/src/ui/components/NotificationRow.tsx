import type { NotificationDoc } from '@prezentowo/types'
import type { TFunction } from 'i18next'
import { type ReactNode, useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { Pressable, View } from 'react-native'

import { inboxTime } from '@/api/notificationInbox'
import type { ResolvedParticipant } from '@/api/participants'
import { Text } from '@/components/ui/text'
import { garland } from '@/constants/colors'
import type { NotificationDetails } from '@/hooks/useNotificationInbox'
import { usePersonName } from '@/hooks/usePersonName'
import { ParticipantAvatar } from '@/ui/components/ParticipantAvatar'

// An actor who no longer resolves gets a grey initial.
const GONE_GREY = '#bbbbbb'

const timeText = (t: TFunction, at: Date, now: Date) => {
  const time = inboxTime(at, now)
  return 'count' in time
    ? t(`notifications.time.${time.kind}`, { count: time.count })
    : t(`notifications.time.${time.kind}`)
}

// The frame every row shares: avatar, text, time, and the New treatment (a
// green wash, a dot at the left edge, a semibold sentence).
function RowFrame({
  isNew,
  onPress,
  avatar,
  time,
  children,
}: {
  isNew: boolean
  onPress?: () => void
  avatar: ReactNode
  time: string
  children: ReactNode
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      className="flex-row items-start gap-3 border-b border-garland-ink-08 px-[18px] py-3 active:opacity-70"
      style={isNew ? { backgroundColor: garland.green12 } : undefined}
    >
      {isNew ? (
        <View
          testID="notification-unread-dot"
          className="absolute left-1.5 top-7 size-[7px] rounded-full bg-garland-green"
        />
      ) : null}
      {avatar}
      <View className="min-w-0 flex-1 gap-[3px]">{children}</View>
      <Text className="mt-0.5 text-[11px] text-garland-ink-40">{time}</Text>
    </Pressable>
  )
}

function Sentence({
  isNew,
  children,
}: {
  isNew: boolean
  children: ReactNode
}) {
  return (
    <Text
      className={`text-sm leading-[18px] text-garland-ink ${isNew ? 'font-semibold' : ''}`}
    >
      {children}
    </Text>
  )
}

function SubLine({ children }: { children: ReactNode }) {
  return <Text className="text-xs text-garland-ink-60">{children}</Text>
}

function PersonAvatar({
  person,
  badge,
  size = 40,
}: {
  person: ResolvedParticipant | undefined
  badge?: string
  size?: number
}) {
  const { t } = useTranslation()
  return (
    <View>
      <ParticipantAvatar
        name={person?.name ?? t('person.someone')}
        avatarKey={person?.avatarKey}
        color={person ? person.color : GONE_GREY}
        size={size}
      />
      {badge ? (
        <View className="absolute -bottom-1 -right-1 size-5 items-center justify-center rounded-full border-[1.5px] border-garland-paper bg-garland-paper">
          <Text className="text-[11px]">{badge}</Text>
        </View>
      ) : null}
    </View>
  )
}

function TileAvatar({
  glyph,
  background,
  color,
}: {
  glyph: string
  background: string
  color?: string
}) {
  return (
    <View
      className="size-10 items-center justify-center rounded-xl"
      style={{ backgroundColor: background }}
    >
      <Text className="text-lg" style={color ? { color } : undefined}>
        {glyph}
      </Text>
    </View>
  )
}

// One notification, laid out per its kind (#28).
export function NotificationRow({
  notification,
  details,
  isNew,
  now,
  onPress,
}: {
  notification: NotificationDoc
  details: NotificationDetails
  isNew: boolean
  now: Date
  onPress?: () => void
}) {
  const { t } = useTranslation()
  const nameOf = usePersonName()
  const { event, invite, actor, recipient, giftGone } = details
  const bold = <Text key="name" className="font-bold" />
  const time = timeText(t, notification.createdAt, now)
  const frame = { isNew, onPress, time }

  switch (notification.kind) {
    case 'invite-deferred':
    case 'invited':
      return (
        <RowFrame
          {...frame}
          avatar={
            <TileAvatar
              glyph="✉︎"
              background={garland.amber15}
              color={garland.amber}
            />
          }
        >
          <Sentence isNew={isNew}>
            {/* Both read "{inviter} invited you to {event}". */}
            <Trans
              i18nKey="notifications.inviteDeferred"
              values={{
                // A creator with no name yet reads "Someone" too.
                inviter: invite?.inviterName || t('person.someone'),
                event: invite?.title,
              }}
              components={[bold]}
            />
          </Sentence>
          <View className="flex-row">
            <Text
              className="rounded-[10px] px-2 py-0.5 text-[11px] font-semibold"
              style={{
                backgroundColor: garland.amber15,
                color: garland.amberInk,
              }}
            >
              {t('notifications.notJoined')}
            </Text>
          </View>
        </RowFrame>
      )
    case 'suggestion-claimed':
      return (
        <RowFrame
          {...frame}
          avatar={<PersonAvatar person={actor} badge="🛍" />}
        >
          <Sentence isNew={isNew}>
            <Trans
              i18nKey="notifications.suggestionClaimed"
              values={{ actor: nameOf(actor), gift: notification.giftTitle }}
              components={[
                bold,
                <Text
                  key="gift"
                  testID={giftGone ? 'notification-gift-gone' : undefined}
                  className={`font-bold ${giftGone ? 'line-through' : ''}`}
                  style={
                    giftGone
                      ? { textDecorationColor: garland.ink40 }
                      : undefined
                  }
                />,
              ]}
            />
          </Sentence>
          <SubLine>
            {giftGone
              ? t('notifications.presentRemoved')
              : t('notifications.suggestedFor', {
                  recipient: nameOf(recipient),
                  event: event?.title,
                })}
          </SubLine>
        </RowFrame>
      )
    case 'participant-joined':
      return (
        <RowFrame
          {...frame}
          avatar={<PersonAvatar person={actor} badge="👋" />}
        >
          <Sentence isNew={isNew}>
            <Trans
              i18nKey="notifications.joined"
              values={{ actor: nameOf(actor), event: event?.title }}
              components={[bold]}
            />
          </Sentence>
          {actor ? null : (
            <SubLine>{t('notifications.noLongerInEvent')}</SubLine>
          )}
        </RowFrame>
      )
    case 'claimed-gift-removed':
      return (
        <RowFrame
          {...frame}
          avatar={<TileAvatar glyph="🎁" background={garland.paper2} />}
        >
          <Sentence isNew={isNew}>
            <Trans
              i18nKey="notifications.giftRemoved"
              values={{ gift: notification.giftTitle, event: event?.title }}
              components={[bold, <Text key="gift" className="font-bold" />]}
            />
          </Sentence>
        </RowFrame>
      )
  }
}

// Two or more joins to one event, coalesced: up to three stacked avatars,
// the first two names, and a "See all N" that lists each join with its time.
export function JoinsRow({
  joins,
  detailsOf,
  isNew,
  now,
  onPress,
}: {
  joins: NotificationDoc[]
  detailsOf: (notification: NotificationDoc) => NotificationDetails
  isNew: boolean
  now: Date
  onPress?: () => void
}) {
  const { t } = useTranslation()
  const nameOf = usePersonName()
  const [expanded, setExpanded] = useState(false)
  const actors = joins.map(join => detailsOf(join).actor)
  const names = actors.map(nameOf)
  const event = detailsOf(joins[0]!).event
  const bold = <Text key="name" className="font-bold" />

  return (
    <View>
      <RowFrame
        isNew={isNew}
        onPress={onPress}
        time={timeText(t, joins[0]!.createdAt, now)}
        avatar={
          <View className="flex-row">
            {actors.slice(0, 3).map((actor, i) => (
              <View
                key={joins[i]!._id}
                className="rounded-full border-2 border-garland-paper"
                style={{ marginLeft: i === 0 ? 0 : -10, zIndex: 3 - i }}
              >
                <PersonAvatar person={actor} size={28} />
              </View>
            ))}
          </View>
        }
      >
        <Sentence isNew={isNew}>
          <Trans
            i18nKey={
              joins.length === 2
                ? 'notifications.joinedTwo'
                : 'notifications.joinedMany'
            }
            count={joins.length - 2}
            values={{
              first: names[0],
              second: names[1],
              event: event?.title,
            }}
            components={[bold]}
          />
        </Sentence>
        <Pressable
          onPress={() => setExpanded(open => !open)}
          hitSlop={8}
          accessibilityRole="button"
          className="self-start"
        >
          <Text className="text-xs font-bold text-garland-green">
            {expanded
              ? t('notifications.hideAll')
              : t('notifications.seeAll', { count: joins.length })}
          </Text>
        </Pressable>
      </RowFrame>
      {expanded ? (
        <View className="gap-1.5 border-b border-garland-ink-08 py-2 pl-[70px] pr-[18px]">
          {joins.map((join, i) => (
            <Text key={join._id} className="text-xs text-garland-ink-60">
              {`👋 ${names[i]} · ${timeText(t, join.createdAt, now)}`}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  )
}
