// Stream chat (docs/spec.md §7): connected lazily, only while a chat screen
// is open, and only ever for the threads `chatThreads.byEvent` publishes.
export { chatSession } from './client'
export {
  useChatConnection,
  useChatRecap,
  useChatSnapshot,
  type ChatRecap,
} from './hooks'
export {
  cidOf,
  eventThreadOf,
  recapOf,
  secretThreadOf,
  type RecapLine,
} from './threads'
