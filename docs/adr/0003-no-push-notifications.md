# No push notifications, and no event-date reminders

Prezentowo has no push transport. Notifications are in-app only (the bell on `3a`, the notifications screen). Nothing is ever scheduled against `EventDoc.date`: no reminder, push or in-app, fires as an event approaches.

The three notification kinds (`invite-deferred`, `suggestion-claimed`, `participant-joined`) are none of them time-critical. The only notification shape whose value depends on reaching someone outside the app is a date reminder, and that is ruled out as a product decision, not deferred.

## Considered Options

- **Expo push for the three kinds.** Rejected. It adds a transport, permission prompts and token management for information that can wait until the next app open.
- **Event-date reminders.** Rejected outright.

## Consequences

- There is nothing to reschedule when an event's date changes.
- A future kind that is genuinely urgent would be a fresh decision, not a reopening of this one.
- GetStream's own chat push is also not enabled. Chat unread state stays inside Stream.
