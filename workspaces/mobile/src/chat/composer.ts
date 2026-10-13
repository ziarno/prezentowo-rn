import type {
  Channel,
  MessageComposer,
  MessageComposerMiddlewareState,
  MessageCompositionMiddleware,
  MiddlewareHandlerParams,
  SendMessageAPIResponse,
  SendMessageOptions,
  StreamChat,
  Message as StreamMessage,
} from 'stream-chat'

import { type MentionPick, composeMentions, mentionText } from './mentions'

// The present mentions a message carries (docs/spec.md §7).
declare module 'stream-chat' {
  interface CustomMessageData {
    // The mentioned presents, in order. Never their titles.
    giftIds?: string[]
    // The text with titles, read by the push template, then cleared.
    pushText?: string
  }
  interface CustomMessageComposerData {
    // Picked in this composer so far. Never sent.
    giftMentions?: MentionPick[]
  }
}

const picksOf = (composer: MessageComposer) =>
  composer.customDataManager.customComposerData.giftMentions ?? []

// Puts a picked present in the composer's text, as `🎁Title`, where the
// cursor is.
export async function insertGiftMention(
  composer: MessageComposer,
  pick: MentionPick,
) {
  composer.customDataManager.setCustomData({
    giftMentions: [...picksOf(composer), pick],
  })
  await composer.textComposer.insertText({
    text: `${mentionText(pick.title)} `,
  })
}

// Runs after Stream's text composition, which sets `text`.
const giftMentionsMiddleware = (
  composer: MessageComposer,
): MessageCompositionMiddleware => ({
  id: 'prezentowo/gift-mentions',
  handlers: {
    compose: ({
      state,
      next,
      forward,
    }: MiddlewareHandlerParams<MessageComposerMiddlewareState>) => {
      const { text } = state.message
      const picks = picksOf(composer)
      const edited = composer.editedMessage ?? undefined
      if (text === undefined || (!picks.length && !edited?.giftIds?.length))
        return forward()
      const composed = composeMentions(text, picks, edited)
      const data = {
        text: composed.text,
        giftIds: composed.giftIds,
        ...(composed.pushText ? { pushText: composed.pushText } : {}),
      }
      return next({
        ...state,
        message: { ...state.message, ...data },
        localMessage: { ...state.localMessage, ...data },
      })
    },
  },
})

// Every composer the client makes gets the middleware.
export function setUpGiftMentions(client: StreamChat) {
  client.setMessageComposerSetupFunction(({ composer }) => {
    composer.compositionMiddlewareExecutor.insert({
      middleware: [giftMentionsMiddleware(composer)],
      position: {
        after: 'stream-io/message-composer-middleware/text-composition',
      },
      unique: true,
    })
  })
}

/**
 * Sends a message, then clears its `pushText` once Stream has it: the push
 * goes out from the message as it was sent, and history keeps no titles. If
 * the clear never lands, the titles stay in that message's data, which the
 * app never draws (docs/spec.md §7).
 */
export async function sendWithPushText(
  channel: Channel,
  message: StreamMessage,
  options?: SendMessageOptions,
): Promise<SendMessageAPIResponse> {
  const response = await channel.sendMessage(message, options)
  if (message.pushText && response.message?.id) {
    void channel
      .getClient()
      .partialUpdateMessage(
        response.message.id,
        { unset: ['pushText'] },
        undefined,
        { skip_push: true },
      )
      .catch(() => {})
  }
  return response
}
