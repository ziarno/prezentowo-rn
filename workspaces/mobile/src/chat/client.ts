import type { StreamToken } from '@prezentowo/types'
import { StreamChat } from 'stream-chat'

import { call } from '@/sync'

import { createChatSession } from './session'

// The app's one Stream client, for the signed-in user (docs/spec.md §7).
export const chatSession = createChatSession({
  fetchToken: () => call<StreamToken>('stream.token'),
  createClient: apiKey => new StreamChat(apiKey),
})
