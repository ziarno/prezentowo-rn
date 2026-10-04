import type {
  DeferredInvite,
  EventDoc,
  NotificationDoc,
} from '@prezentowo/types'
import { useEffect, useState } from 'react'

import { findEventById } from '@/api/events'
import { findGiftById } from '@/api/gifts'
import {
  type InboxSection,
  type NotificationTarget,
  inboxSections,
  isInvite,
  notificationTarget,
} from '@/api/notificationInbox'
import {
  findDeferredInvite,
  findMyNotifications,
  markAllNotificationsRead,
} from '@/api/notifications'
import {
  type ResolvedParticipant,
  resolveParticipants,
} from '@/api/participants'
import { findUserById, getCurrentUser } from '@/api/users'
import {
  isSubscriptionReady,
  useSubscription,
  useSubscriptionPerId,
  useTracker,
} from '@/sync'

// What one row needs beyond its notification, read as of now.
export type NotificationDetails = {
  // Every kind but the invitations, whose event isn't the viewer's yet.
  event?: EventDoc
  invite?: DeferredInvite
  // The claimer or the joiner; undefined once they've left the event.
  actor?: ResolvedParticipant
  recipient?: ResolvedParticipant
  // The claimed present is known to be deleted.
  giftGone: boolean
  target: NotificationTarget | null
}

export type NotificationInbox = {
  ready: boolean
  sections: InboxSection[]
  details: (notification: NotificationDoc) => NotificationDetails
}

/**
 * The notifications screen's data. Which rows were unread is snapshotted the
 * first time the list arrives, and only then is everything marked read, so
 * the New styling lasts until the screen is left. A notification whose event
 * the viewer has since lost is left out: there is nothing left to open.
 */
export function useNotificationInbox(): NotificationInbox {
  const notificationsReady = useSubscription('notifications.mine', [])
  const eventsReady = useSubscription('events.mine', [])
  const invitesReady = useSubscription('invites.deferred', [])
  const notifications = useTracker(() => findMyNotifications())

  const memberEventIds = notifications
    .filter(n => !isInvite(n))
    .map(n => n.eventId)
  const giftEventIds = notifications
    .filter(n => n.kind === 'suggestion-claimed')
    .map(n => n.eventId)
  const usersReady = useSubscriptionPerId('users.inEvent', memberEventIds)
  useSubscriptionPerId('gifts.byEvent', giftEventIds)

  const [unreadAtOpen, setUnreadAtOpen] = useState<ReadonlySet<string> | null>(
    null,
  )
  if (notificationsReady && unreadAtOpen === null) {
    setUnreadAtOpen(new Set(notifications.filter(n => !n.read).map(n => n._id)))
  }
  useEffect(() => {
    // Offline, they just stay unread until the next open.
    if (unreadAtOpen) markAllNotificationsRead().catch(() => {})
  }, [unreadAtOpen])

  const details = useTracker(() => {
    const viewerId = getCurrentUser()?._id
    const participantsOf = new Map<string, ResolvedParticipant[]>()
    const resolve = (event: EventDoc, participantId: string | undefined) => {
      if (!participantId) return undefined
      let participants = participantsOf.get(event._id)
      if (!participants) {
        participants = resolveParticipants(event, viewerId, findUserById)
        participantsOf.set(event._id, participants)
      }
      return participants.find(p => p.id === participantId)
    }

    return new Map(
      notifications.map(n => {
        const event = findEventById(n.eventId)
        const invite = isInvite(n) ? findDeferredInvite(n.eventId) : undefined
        const actorId =
          n.kind === 'participant-joined'
            ? n.joinedParticipantId
            : n.claimedByParticipantId
        const recipient = event && resolve(event, n.recipientParticipantId)
        const giftGone =
          n.kind === 'suggestion-claimed' &&
          !!n.giftId &&
          isSubscriptionReady('gifts.byEvent', [n.eventId]) &&
          !findGiftById(n.giftId)
        const value: NotificationDetails = {
          event,
          invite,
          actor: event && resolve(event, actorId),
          recipient,
          giftGone,
          target: notificationTarget(n, {
            inviteCode: invite?.code,
            giftGone,
            recipientInEvent: !!recipient,
          }),
        }
        return [n._id, value] as const
      }),
    )
  }, [notifications])

  const visible = notifications.filter(n => {
    const { event, invite } = details.get(n._id) ?? {}
    return isInvite(n) ? !!invite : !!event
  })
  const now = new Date()

  return {
    ready: notificationsReady && eventsReady && invitesReady && usersReady,
    sections: inboxSections(
      visible,
      n => !!unreadAtOpen?.has(n._id) || !n.read,
      now,
    ),
    details: n => details.get(n._id) ?? { giftGone: false, target: null },
  }
}
