import { uploadDraftImage } from '@/api/draftImage'
import { rememberAddedGift } from '@/api/gifts'
import { downloadImage, uploadImage } from '@/api/images'
import type { QueuedAddGiftArgs } from '@/api/pendingWrites'
import { queueable } from '@/sync'

// The only writes the offline queue takes (docs/spec.md §6.3, ADR 0004).
// Registered before the connection opens, so a replay never finds one
// missing. Every other write is online-only.

// A queued add carries its photo as the device (or shop) has it; it's
// uploaded just before the add is sent.
queueable('gifts.add', {
  prepare: async ({ image, ...args }: QueuedAddGiftArgs) => {
    const uploaded = await uploadDraftImage(image, uploadImage, downloadImage)
    return uploaded ? { ...args, image: uploaded } : args
  },
  sent: (args: QueuedAddGiftArgs, result: { _id: string }) =>
    rememberAddedGift(args.clientId, result._id),
})
queueable('gifts.claim')
queueable('gifts.unclaim')
