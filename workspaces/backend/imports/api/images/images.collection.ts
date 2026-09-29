import { Mongo } from 'meteor/mongo'

// One per upload, keyed by the upload's id (its directory under IMAGES_DIR).
// Records who uploaded it, for cleanup; never published.
export type ImageRecord = { _id: string; ownerId: string; createdAt: Date }

export const Images = new Mongo.Collection<ImageRecord>('images')
