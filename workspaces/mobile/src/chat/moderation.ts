// Chat moderation (docs/spec.md §7.1): Stream's Flag Message and Block User
// actions, which the long-press menu offers on anyone else's message.

// Stream's block only stops direct messages: in a group channel, which every
// thread is, the blocked person's messages still arrive. So the screen hides
// them itself, for the blocker only; nothing is sent, and nobody is told.
export const isFromBlockedUser = (
  blockedUserIds: readonly string[],
  message: { user?: { id: string } | null },
): boolean => !!message.user && blockedUserIds.includes(message.user.id)
