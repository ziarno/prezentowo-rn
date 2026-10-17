// Stream chat (docs/spec.md §7): connected lazily, only while a chat screen
// is open, and only ever for the threads `chatThreads.byEvent` publishes.
export { chatSession } from './client'
export { insertGiftMention, sendWithPushText } from './composer'
export { chatI18n } from './i18n'
export {
  useChatConnection,
  useChatRecap,
  useChatSnapshot,
  type ChatRecap,
} from './hooks'
export { isFromBlockedUser } from './moderation'
export {
  cidOf,
  eventThreadOf,
  recapOf,
  secretThreadOf,
  type RecapLine,
} from './threads'
export {
  MENTION_ICON,
  RENDERED_MENTION,
  type MentionPick,
  mentionBlocker,
  mentionRanges,
  renderableMentions,
} from './mentions'
