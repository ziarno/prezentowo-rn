import * as Notifications from 'expo-notifications'
import { router } from 'expo-router'
import { useEffect, useRef, useState } from 'react'

import { findChatThreads } from '@/api/chatThreads'
import { findEventById } from '@/api/events'
import { findGiftById } from '@/api/gifts'
import { findDeferredInvite } from '@/api/notifications'
import {
  type Push,
  type PushResponse,
  chatPushTarget,
  createTappedPushes,
  inboxPushTarget,
  publicationsFor,
} from '@/push'
import { isSubscriptionReady, useSubscription, useTracker } from '@/sync'

// How long a tapped push waits for the data its screen is chosen by, before
// it's chosen from whatever has arrived.
const RESOLVE_TIMEOUT_MS = 5_000

// Module-wide, so a remount doesn't reopen what was already opened.
const tapped = createTappedPushes()

/**
 * Opens the screen of a tapped push once the app is open (docs/spec.md
 * §10.5), cold start included: an inbox push routes like its inbox row, a
 * chat push opens its thread. Nothing is marked read.
 */
export function usePushOpening(appOpen: boolean) {
  const [push, setPush] = useState<Push | null>(null)

  useEffect(() => {
    const take = (response: PushResponse) => {
      const next = tapped.take(response)
      if (next) setPush(next)
      // Read; a reload of the JS mustn't open it again.
      Notifications.clearLastNotificationResponse()
    }
    // The tap that launched the app, which the listener may or may not
    // report too.
    const launch = Notifications.getLastNotificationResponse()
    if (launch) take(launch)
    const subscription =
      Notifications.addNotificationResponseReceivedListener(take)
    return () => subscription.remove()
  }, [])

  const target = usePushTarget(appOpen ? push : null)
  // Its target keeps being worked out until the next tap replaces it.
  const opened = useRef<Push | null>(null)

  useEffect(() => {
    if (!push || target === undefined || opened.current === push) return
    opened.current = push
    if (target) router.push(target)
  }, [push, target])
}

/**
 * The screen `push` opens: undefined while its data is still on the way,
 * null when there's nothing to open (the event or thread is gone).
 */
function usePushTarget(push: Push | null) {
  const needed = push ? publicationsFor(push) : []
  const paramsOf = (name: string) =>
    needed.find(([n]) => n === name)?.[1] ?? null
  useSubscription('events.mine', paramsOf('events.mine'))
  useSubscription('invites.deferred', paramsOf('invites.deferred'))
  useSubscription('gifts.byEvent', paramsOf('gifts.byEvent'))
  useSubscription('chatThreads.byEvent', paramsOf('chatThreads.byEvent'))

  const [timedOutFor, setTimedOutFor] = useState<Push | null>(null)
  useEffect(() => {
    if (!push) return
    const timer = setTimeout(() => setTimedOutFor(push), RESOLVE_TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [push])
  const timedOut = push !== null && timedOutFor === push

  return useTracker(() => {
    if (!push) return undefined
    const ready = publicationsFor(push).every(([name, params]) =>
      isSubscriptionReady(name, params),
    )
    if (!ready && !timedOut) return undefined
    if (push.kind === 'chat') {
      return chatPushTarget(push, findChatThreads(push.eventId))
    }

    const { data } = push
    const event = findEventById(data.eventId)
    return inboxPushTarget(data, {
      eventKnown: !!event,
      inviteCode: findDeferredInvite(data.eventId)?.code,
      giftGone:
        !!data.giftId &&
        isSubscriptionReady('gifts.byEvent', [data.eventId]) &&
        !findGiftById(data.giftId),
      recipientInEvent: !!event?.participants.some(
        p => p.id === data.recipientParticipantId,
      ),
    })
  }, [push, timedOut])
}
